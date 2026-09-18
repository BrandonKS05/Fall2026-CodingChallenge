/**
 * OpenAI's embeddings endpoint, with the three things that make it usable from
 * a queue: it chunks to the provider's batch limit, it retries the failures
 * that are worth retrying, and it hands back unit vectors whatever arrives.
 */
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import { RECOMMENDATIONS } from '../../../config/recommendations.js';
import { normalize, type EmbeddingClient } from '../ports/EmbeddingClient.js';

interface Options {
  apiKey: string;
  fetchFn: FetchFn;
  logger: Logger;
  baseUrl?: string;
  /** Injected in tests so retries do not really wait. */
  sleep?: (ms: number) => Promise<void>;
}

interface EmbeddingResponse {
  data?: { index: number; embedding: number[] }[];
}

const { batchSize, maxAttempts, model, requestTimeoutMs, retryBaseMs } = RECOMMENDATIONS.embedding;

/** A bad request will be bad again; a rate limit or an outage may not be. */
function worthRetrying(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export class OpenAIEmbeddingClient implements EmbeddingClient {
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: Options) {
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += batchSize) {
      vectors.push(...(await this.embedBatch(texts.slice(start, start + batchSize))));
    }
    return vectors;
  }

  private async embedBatch(batch: string[]): Promise<number[][]> {
    if (batch.length === 0) return [];
    let lastError = new Error('No attempt was made');

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.request(batch);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = !(error instanceof PermanentEmbeddingError);
        if (!retryable || attempt === maxAttempts) break;
        // Doubling, so a provider having a bad minute is not hammered.
        await this.sleep(retryBaseMs * 2 ** (attempt - 1));
        this.options.logger.warn(
          { attempt, size: batch.length, error: lastError.message },
          'Retrying an embedding batch',
        );
      }
    }
    throw lastError;
  }

  private async request(batch: string[]): Promise<number[][]> {
    const response = await this.options.fetchFn(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, input: batch }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const message = `Embedding request failed: ${response.status} ${detail.slice(0, 200)}`;
      throw worthRetrying(response.status)
        ? new Error(message)
        : new PermanentEmbeddingError(message);
    }

    const body = (await response.json()) as EmbeddingResponse;
    const data = body.data ?? [];
    if (data.length !== batch.length) {
      throw new Error(
        `Embedding request returned ${data.length} vectors for ${batch.length} texts`,
      );
    }
    // The provider may answer out of order; the caller pairs by position.
    return [...data].sort((a, b) => a.index - b.index).map((entry) => normalize(entry.embedding));
  }
}

/** A failure that will happen again however many times it is tried. */
class PermanentEmbeddingError extends Error {}
