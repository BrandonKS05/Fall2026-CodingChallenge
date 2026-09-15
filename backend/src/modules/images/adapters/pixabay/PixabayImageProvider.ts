import { nearestSearchColor } from '@wumboo/shared';
import { UpstreamError } from '../../../../domain/errors/index.js';
import type { FetchFn } from '../../../../infrastructure/http/fetch.js';
import type {
  ImageProvider,
  ImageSearchQuery,
  ImageSearchResult,
} from '../../ports/ImageProvider.js';
import type { ProviderImage } from '../../../../domain/entities/ProviderImage.js';
import { pixabayResponseSchema, toProviderImage, type PixabayResponse } from './pixabayAdapter.js';

export interface PixabayOptions {
  apiKey: string;
  /** Defaults to the real API; tests and local verification point it at a mock. */
  baseUrl?: string;
  fetchFn?: FetchFn;
  timeoutMs?: number;
}

/** Pixabay asks for at least 3 results per page. */
const MIN_PER_PAGE = 3;

/** Strategy implementation for https://pixabay.com/api/docs/. Never logs the URL, which carries the key. */
export class PixabayImageProvider implements ImageProvider {
  readonly name = 'pixabay' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(options: PixabayOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://pixabay.com/api/';
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async search(query: ImageSearchQuery): Promise<ImageSearchResult> {
    const data = await this.request({
      q: query.q,
      page: query.page,
      per_page: Math.max(MIN_PER_PAGE, query.perPage),
      orientation: query.orientation,
      // Pixabay indexes colours by name, so a picked shade becomes the nearest word.
      colors: query.colorHex ? nearestSearchColor(query.colorHex) : query.color,
      image_type: query.type ?? 'all',
      category: query.category,
      order: query.order ?? 'popular',
      editors_choice: query.editorsChoice ? 'true' : undefined,
      min_width: query.minWidth,
      min_height: query.minHeight,
      safesearch: 'true',
    });
    return {
      results: data.hits.slice(0, query.perPage).map(toProviderImage),
      page: query.page,
      perPage: query.perPage,
      total: data.totalHits,
    };
  }

  async getById(providerImageId: string): Promise<ProviderImage | null> {
    try {
      const data = await this.request({ id: providerImageId });
      const hit = data.hits[0];
      return hit ? toProviderImage(hit) : null;
    } catch (error) {
      // Pixabay answers 400 for an id it does not recognize.
      if (error instanceof UpstreamError && error.status === 400) return null;
      throw error;
    }
  }

  private async request(
    params: Record<string, string | number | undefined>,
  ): Promise<PixabayResponse> {
    const url = new URL(this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    url.searchParams.set('key', this.apiKey);

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw new UpstreamError('Image provider is unreachable');
    }

    if (response.status === 429) {
      throw new UpstreamError('Image provider rate limit reached, try again in a minute', 429);
    }
    if (!response.ok) {
      throw new UpstreamError(
        `Image provider request failed (${response.status})`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UpstreamError('Unexpected response from image provider');
    }
    const parsed = pixabayResponseSchema.safeParse(payload);
    if (!parsed.success) throw new UpstreamError('Unexpected response from image provider');
    return parsed.data;
  }
}
