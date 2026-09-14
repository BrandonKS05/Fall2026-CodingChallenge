import { describe, expect, it } from 'vitest';
import { buildTestEnv } from '../../testing/testApp.js';
import { LocalDiskStorage } from './LocalDiskStorage.js';
import { S3Storage } from './S3Storage.js';
import { createStorage } from './storageFactory.js';

describe('createStorage', () => {
  it('selects the strategy from STORAGE_DRIVER', () => {
    expect(createStorage(buildTestEnv(), '/tmp/backend')).toBeInstanceOf(LocalDiskStorage);
    const s3 = createStorage(
      buildTestEnv({
        STORAGE_DRIVER: 's3',
        S3_BUCKET: 'b',
        S3_REGION: 'auto',
        S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
      }),
      '/tmp/backend',
    );
    expect(s3).toBeInstanceOf(S3Storage);
  });
});
