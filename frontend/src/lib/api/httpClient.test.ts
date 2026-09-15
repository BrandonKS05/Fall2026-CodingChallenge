import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './ApiError';
import { HttpClient } from './httpClient';

function stubFetch(status: number, body: unknown = null) {
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    async () =>
      body === null
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('HttpClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds urls with the base path and skips empty query values', () => {
    const client = new HttpClient('/api');
    expect(
      client.url('/search', { q: 'red cats', page: 2, color: undefined, orientation: '' }),
    ).toBe('/api/search?q=red+cats&page=2');
  });

  it('sends json with credentials and returns the parsed body', async () => {
    const fetchMock = stubFetch(201, { id: '1' });
    const result = await new HttpClient().post<{ id: string }>('/collections', { title: 'x' });

    expect(result).toEqual({ id: '1' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/collections');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBe('{"title":"x"}');
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('treats 204 as empty', async () => {
    stubFetch(204);
    await expect(new HttpClient().delete('/collections/1')).resolves.toBeUndefined();
  });

  it('maps the error envelope to ApiError and falls back when the body is not one', async () => {
    stubFetch(409, { error: { code: 'CONFLICT', message: 'Already exists' } });
    const error = await new HttpClient().post('/collections', {}).catch((e: unknown) => e);
    expect(ApiError.is(error, 'CONFLICT')).toBe(true);
    expect((error as ApiError).message).toBe('Already exists');

    stubFetch(502);
    const fallback = await new HttpClient().get('/x').catch((e: unknown) => e);
    expect(fallback).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});
