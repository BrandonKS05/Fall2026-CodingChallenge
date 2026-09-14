import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageBackend, StoredObject } from '../../ports/StorageBackend.js';
import { assertSafeKey, contentTypeForKey } from './keys.js';

/** Strategy: files under a directory on this machine. The default for development. */
export class LocalDiskStorage implements StorageBackend {
  constructor(private readonly rootDir: string) {}

  async put(key: string, body: Uint8Array, _contentType: string): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Write to a temp file and rename so a crash never leaves a half-written image.
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, body);
    await rename(temp, target);
  }

  async get(key: string): Promise<StoredObject | null> {
    const target = this.resolve(key);
    try {
      const info = await stat(target);
      return {
        stream: createReadStream(target),
        contentType: contentTypeForKey(key),
        size: info.size,
      };
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    return path.join(this.rootDir, key);
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
