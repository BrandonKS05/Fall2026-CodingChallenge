import { Readable } from 'node:stream';
import type { StorageBackend, StoredObject } from '../../ports/StorageBackend.js';

export class InMemoryStorage implements StorageBackend {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      stream: Readable.from([Buffer.from(object.body)]),
      contentType: object.contentType,
      size: object.body.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
