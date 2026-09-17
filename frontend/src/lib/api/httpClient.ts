/**
 * Facade over fetch for the Wumboo API. Every feature talks to the backend
 * through this class and nothing else, so credentials, JSON handling, and
 * error mapping live in exactly one place.
 */
import { ApiError } from './ApiError';

export type QueryParams = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

export class HttpClient {
  constructor(private readonly baseUrl = '/api') {}

  get<T>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  /**
   * A file, sent as itself: the browser already knows its type, and one picture
   * needs no multipart envelope to travel in.
   */
  postFile<T>(path: string, file: Blob, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('POST', path, { ...options, body: file });
  }

  patch<T>(path: string, body: unknown, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  delete<T = void>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /** Builds the URL so links to raw resources (images) use the same base as API calls. */
  url(path: string, query?: QueryParams): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    return `${this.baseUrl}${path}${suffix}`;
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const file = options.body instanceof Blob ? options.body : null;
    if (file) headers['content-type'] = file.type || 'application/octet-stream';
    else if (options.body !== undefined) headers['content-type'] = 'application/json';

    // Looked up per call so tests can stub the global.
    const response = await globalThis.fetch(this.url(path, options.query), {
      method,
      headers,
      body: file ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      credentials: 'same-origin',
      signal: options.signal ?? null,
    });

    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw ApiError.fromResponse(response.status, data);
    return data as T;
  }
}

export const http = new HttpClient();
