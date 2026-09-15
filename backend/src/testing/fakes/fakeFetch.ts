import type { FetchFn } from '../../infrastructure/http/fetch.js';

export interface FakeRoute {
  status?: number;
  contentType?: string;
  body: Uint8Array | string;
  headers?: Record<string, string>;
}

/** A 1x1 JPEG-looking payload; the pipeline only checks type and size, not pixels. */
export const FAKE_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

/** Responds to exact URLs (query string included), or to '*' as a fallback, and records every call. */
export function createFakeFetch(routes: Record<string, FakeRoute>): FetchFn & { calls: string[] } {
  const calls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    const route = routes[url] ?? routes['*'];
    if (!route) return new Response('not found', { status: 404 });
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: { 'content-type': route.contentType ?? 'application/json', ...route.headers },
    });
  }) as FetchFn & { calls: string[] };
  fakeFetch.calls = calls;
  return fakeFetch;
}
