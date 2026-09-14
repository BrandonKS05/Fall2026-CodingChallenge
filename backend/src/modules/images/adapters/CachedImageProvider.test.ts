import { describe, expect, it } from 'vitest';
import type { ImageProvider, ImageSearchQuery, ImageSearchResult } from '../ports/ImageProvider.js';
import { FakeImageProvider, fakeProviderImage } from '../../../testing/fakes/FakeImageProvider.js';
import { CachedImageProvider } from './CachedImageProvider.js';

const query: ImageSearchQuery = { q: 'kitchen', page: 1, perPage: 10, orientation: 'all' };

describe('CachedImageProvider', () => {
  it('serves repeated searches from the cache, normalizing the query text', async () => {
    const inner = new FakeImageProvider([fakeProviderImage('1')]);
    const cached = new CachedImageProvider(inner);

    const first = await cached.search(query);
    const second = await cached.search({ ...query, q: '  Kitchen ' });
    expect(second).toBe(first);
    expect(inner.searchCalls).toHaveLength(1);

    await cached.search({ ...query, page: 2 });
    expect(inner.searchCalls).toHaveLength(2);
  });

  it('shares one upstream request between identical concurrent searches', async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const slow: ImageProvider = {
      name: 'pixabay',
      search: () =>
        new Promise<ImageSearchResult>((resolve) => {
          calls += 1;
          release = () => resolve({ results: [], page: 1, perPage: 10, total: 0 });
        }),
      getById: async () => null,
    };
    const cached = new CachedImageProvider(slow);

    const pending = Promise.all([cached.search(query), cached.search(query)]);
    release?.();
    await pending;
    expect(calls).toBe(1);
  });

  it('caches image lookups but not misses', async () => {
    const inner = new FakeImageProvider([fakeProviderImage('1')]);
    const cached = new CachedImageProvider(inner);

    await cached.getById('1');
    await cached.getById('1');
    expect(inner.getByIdCalls).toEqual(['1']);

    await cached.getById('missing');
    await cached.getById('missing');
    expect(inner.getByIdCalls).toEqual(['1', 'missing', 'missing']);
  });
});
