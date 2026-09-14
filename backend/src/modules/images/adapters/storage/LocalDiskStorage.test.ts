import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalDiskStorage } from './LocalDiskStorage.js';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'trove-storage-'));
    storage = new LocalDiskStorage(root);
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('round-trips a file, creating directories and leaving no temp files', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await storage.put('images/abc.jpg', bytes, 'image/jpeg');

    const object = await storage.get('images/abc.jpg');
    expect(object).not.toBeNull();
    expect(object?.contentType).toBe('image/jpeg');
    expect(object?.size).toBe(4);
    expect(await readAll(object!.stream)).toEqual(Buffer.from(bytes));

    expect((await stat(path.join(root, 'images', 'abc.jpg'))).isFile()).toBe(true);
    expect((await readdir(path.join(root, 'images'))).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('returns null for missing keys and deletes idempotently', async () => {
    expect(await storage.get('images/nope.png')).toBeNull();
    await storage.put('images/gone.png', new Uint8Array([9]), 'image/png');
    await storage.delete('images/gone.png');
    await storage.delete('images/gone.png');
    expect(await storage.get('images/gone.png')).toBeNull();
  });

  it('refuses keys that could escape the root', async () => {
    await expect(storage.put('../escape.jpg', new Uint8Array(), 'image/jpeg')).rejects.toThrow(/Unsafe/);
    await expect(storage.get('/etc/passwd')).rejects.toThrow(/Unsafe/);
  });
});
