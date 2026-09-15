import { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { S3Storage, type S3Sender } from './S3Storage.js';

function storageWith(send: ReturnType<typeof vi.fn>) {
  return new S3Storage({ send } as unknown as S3Sender, 'trove-bucket');
}

describe('S3Storage', () => {
  it('uploads with bucket, key, and content type', async () => {
    const send = vi.fn().mockResolvedValue({});
    await storageWith(send).put('images/a.webp', new Uint8Array([1]), 'image/webp');

    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'trove-bucket',
      Key: 'images/a.webp',
      ContentType: 'image/webp',
    });
  });

  it('wraps a downloaded object and maps NoSuchKey to null', async () => {
    const send = vi.fn().mockResolvedValue({
      Body: Readable.from([Buffer.from('x')]),
      ContentType: 'image/png',
      ContentLength: 1,
    });
    const object = await storageWith(send).get('images/a.png');
    expect(object).toMatchObject({ contentType: 'image/png', size: 1 });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);

    const missing = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));
    expect(await storageWith(missing).get('images/b.png')).toBeNull();
  });

  it('deletes by key', async () => {
    const send = vi.fn().mockResolvedValue({});
    await storageWith(send).delete('images/a.png');
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
