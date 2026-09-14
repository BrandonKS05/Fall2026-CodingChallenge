import type { Readable } from 'node:stream';

export interface StoredObject {
  stream: Readable;
  contentType: string;
  size: number;
}

/**
 * Strategy for where downloaded image files live. Keys look like
 * `images/<uuid>.jpg`; the extension carries the content type so any
 * backend can serve the file with the right headers.
 */
export interface StorageBackend {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Resolves null when nothing is stored under the key. */
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
