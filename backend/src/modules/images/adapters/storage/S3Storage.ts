import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { StorageBackend, StoredObject } from '../../ports/StorageBackend.js';
import { assertSafeKey, contentTypeForKey } from './keys.js';

/** The only part of the SDK client we use, so tests can pass a stub. */
export type S3Sender = Pick<S3Client, 'send'>;

/** Strategy: any S3-compatible bucket (AWS S3, Cloudflare R2, Supabase Storage). Used in production. */
export class S3Storage implements StorageBackend {
  constructor(
    private readonly client: S3Sender,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    assertSafeKey(key);
    try {
      const output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!output.Body) return null;
      return {
        stream: output.Body as unknown as Readable,
        contentType: output.ContentType ?? contentTypeForKey(key),
        size: output.ContentLength ?? 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
