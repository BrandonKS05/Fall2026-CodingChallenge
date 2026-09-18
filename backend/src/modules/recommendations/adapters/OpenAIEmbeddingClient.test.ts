import { describe, expect, it } from 'vitest';
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import { silentLogger } from '../../../testing/fakes/fakeAuth.js';
import { RECOMMENDATIONS } from '../../../config/recommendations.js';
import { OpenAIEmbeddingClient } from './OpenAIEmbeddingClient.js';

interface Call {
  model: string;
  input: string[];
}

/** Answers with a vector per text, and lets a test make the first n attempts fail. */
function stubOpenAI(failures: { status: number }[] = []) {
  const calls: Call[] = [];
  let failed = 0;
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Call;
    calls.push(body);
    const failure = failures[failed];
    if (failure) {
      failed += 1;
      return new Response('upstream said no', { status: failure.status });
    }
    return Response.json({
      // Deliberately reversed: the provider does not promise an order.
      data: body.input.map((text, index) => ({ index, embedding: [text.length, 0, 3] })).reverse(),
    });
  }) as unknown as FetchFn;
  return { calls, fetchFn };
}

const client = (stub: ReturnType<typeof stubOpenAI>) =>
  new OpenAIEmbeddingClient({
    apiKey: 'sk-test',
    fetchFn: stub.fetchFn,
    logger: silentLogger,
    sleep: async () => undefined,
  });

describe('OpenAIEmbeddingClient', () => {
  it('returns unit vectors, in the order the texts were given', async () => {
    const stub = stubOpenAI();
    const [first, second] = await client(stub).embed(['a', 'bbbb']);

    // [1,0,3] and [4,0,3] normalized: same direction, length one.
    expect(Math.hypot(...first!)).toBeCloseTo(1, 10);
    expect(first![0]! / first![2]!).toBeCloseTo(1 / 3, 10);
    expect(second![0]! / second![2]!).toBeCloseTo(4 / 3, 10);
  });

  it('never asks for more than the provider will take in one go', async () => {
    const stub = stubOpenAI();
    const size = RECOMMENDATIONS.embedding.batchSize;
    const texts = Array.from({ length: size + 5 }, (_, index) => `t${index}`);

    const vectors = await client(stub).embed(texts);

    expect(vectors).toHaveLength(texts.length);
    expect(stub.calls.map((call) => call.input.length)).toEqual([size, 5]);
    expect(stub.calls[0]?.model).toBe(RECOMMENDATIONS.embedding.model);
  });

  it('tries again through a rate limit and an outage', async () => {
    const stub = stubOpenAI([{ status: 429 }, { status: 503 }]);
    const vectors = await client(stub).embed(['a']);

    expect(vectors).toHaveLength(1);
    expect(stub.calls).toHaveLength(3);
  });

  it('gives up at once on a request that will never be accepted', async () => {
    const stub = stubOpenAI([{ status: 400 }]);

    await expect(client(stub).embed(['a'])).rejects.toThrow(/400/);
    // One attempt, not four: a bad request stays bad.
    expect(stub.calls).toHaveLength(1);
  });

  it('gives up once it has run out of attempts', async () => {
    const stub = stubOpenAI(Array.from({ length: 10 }, () => ({ status: 500 })));

    await expect(client(stub).embed(['a'])).rejects.toThrow(/500/);
    expect(stub.calls).toHaveLength(RECOMMENDATIONS.embedding.maxAttempts);
  });

  it('refuses an answer that does not line up with the question', async () => {
    const stub = stubOpenAI();
    const fetchFn = (async () =>
      Response.json({ data: [{ index: 0, embedding: [1] }] })) as unknown as FetchFn;

    const mismatched = new OpenAIEmbeddingClient({
      apiKey: 'sk-test',
      fetchFn,
      logger: silentLogger,
      sleep: async () => undefined,
    });
    await expect(mismatched.embed(['a', 'b'])).rejects.toThrow(/1 vectors for 2 texts/);
    expect(stub.calls).toHaveLength(0);
  });
});
