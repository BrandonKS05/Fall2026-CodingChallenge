import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../../config/env.js';
import type { StorageBackend } from '../../ports/StorageBackend.js';
import { LocalDiskStorage } from './LocalDiskStorage.js';
import { S3Storage } from './S3Storage.js';

/**
 * Factory: picks the StorageBackend strategy from configuration. The rest of
 * the app never knows which one it got.
 */
export function createStorage(env: Env, backendRoot: string): StorageBackend {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalDiskStorage(path.resolve(backendRoot, env.STORAGE_LOCAL_DIR));
    case 's3': {
      const s3 = requireS3Config(env);
      const client = new S3Client({
        region: s3.region,
        credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
        // Non-AWS providers (R2, Supabase) are addressed by endpoint with path-style keys.
        ...(s3.endpoint && { endpoint: s3.endpoint, forcePathStyle: true }),
      });
      return new S3Storage(client, s3.bucket);
    }
  }
}

interface S3Config {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Env validation already enforces this; the check here narrows the types for the compiler. */
function requireS3Config(env: Env): S3Config {
  const { S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY');
  }
  return {
    bucket: S3_BUCKET,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}
