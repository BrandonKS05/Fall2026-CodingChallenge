import { describe, expect, it } from 'vitest';
import { UpstreamError } from '../../../../domain/errors/index.js';
import { createFakeFetch } from '../../../../testing/fakes/fakeFetch.js';
import { PixabayImageProvider } from './PixabayImageProvider.js';
import { sampleHit } from './pixabayAdapter.test.js';

const okBody = JSON.stringify({ total: 1, totalHits: 1, hits: [sampleHit] });
const baseUrl = 'https://pixabay.test/api/';

function providerWith(route: { status?: number; body: string }) {
  const fetchFn = createFakeFetch({ '*': route });
  return { fetchFn, provider: new PixabayImageProvider({ apiKey: 'secret', baseUrl, fetchFn }) };
}

describe('PixabayImageProvider', () => {
  it('builds the request from the query and maps the response', async () => {
    const { fetchFn, provider } = providerWith({ body: okBody });
    const result = await provider.search({
      q: 'red cats',
      page: 2,
      perPage: 1,
      orientation: 'horizontal',
      color: 'red',
    });

    const url = new URL(fetchFn.calls[0] ?? '');
    expect(url.origin + url.pathname).toBe(baseUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'secret',
      q: 'red cats',
      page: '2',
      per_page: '3', // Pixabay's minimum, even when the caller wants 1
      orientation: 'horizontal',
      colors: 'red',
      image_type: 'all',
      order: 'popular',
      safesearch: 'true',
    });
    expect(result).toMatchObject({ page: 2, perPage: 1, total: 1 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.providerImageId).toBe('195893');
  });

  it('sends every filter it is given, and matches a picked colour to the nearest name', async () => {
    const { fetchFn, provider } = providerWith({ body: okBody });

    await provider.search({
      q: 'kitchen',
      page: 1,
      perPage: 10,
      orientation: 'all',
      colorHex: '#12c0b4',
      type: 'illustration',
      category: 'food',
      order: 'latest',
      editorsChoice: true,
      minWidth: 1920,
      minHeight: 1080,
    });

    const params = Object.fromEntries(new URL(fetchFn.calls[0] ?? '').searchParams);
    expect(params).toMatchObject({
      image_type: 'illustration',
      category: 'food',
      order: 'latest',
      editors_choice: 'true',
      min_width: '1920',
      min_height: '1080',
      // #12c0b4 is closest to the colour Pixabay calls turquoise.
      colors: 'turquoise',
    });
  });

  it('looks up a single image by id', async () => {
    const { fetchFn, provider } = providerWith({ body: okBody });
    const image = await provider.getById('195893');
    expect(image?.credit.name).toBe('Josch13');
    expect(new URL(fetchFn.calls[0] ?? '').searchParams.get('id')).toBe('195893');
  });

  it('treats an unknown id as null instead of an error', async () => {
    expect(
      await providerWith({ status: 400, body: '[ERROR 400] "id" is invalid' }).provider.getById(
        'x',
      ),
    ).toBeNull();
    expect(
      await providerWith({
        body: JSON.stringify({ total: 0, totalHits: 0, hits: [] }),
      }).provider.getById('1'),
    ).toBeNull();
  });

  it('turns rate limiting, failures, and garbage into UpstreamError', async () => {
    const query = { q: 'x', page: 1, perPage: 5, orientation: 'all' as const };
    await expect(
      providerWith({ status: 429, body: '' }).provider.search(query),
    ).rejects.toMatchObject({
      constructor: UpstreamError,
      status: 429,
    });
    await expect(
      providerWith({ status: 500, body: 'boom' }).provider.search(query),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      providerWith({ body: '<html>not json</html>' }).provider.search(query),
    ).rejects.toBeInstanceOf(UpstreamError);

    const offline = new PixabayImageProvider({
      apiKey: 'k',
      baseUrl,
      fetchFn: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.search(query)).rejects.toThrow(/unreachable/);
  });
});
