import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env.js';
import { TEST_ENV } from '../helpers/testApp.js';

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(TEST_ENV);
    expect(env.PORT).toBe(4000);
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('treats empty strings as unset', () => {
    expect(() => loadEnv({ ...TEST_ENV, JWT_SECRET: '' })).toThrow(EnvError);
  });

  it('reports every problem at once', () => {
    expect.assertions(2);
    try {
      loadEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect((error as EnvError).issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('DATABASE_URL'),
          expect.stringContaining('JWT_SECRET'),
          expect.stringContaining('PIXABAY_API_KEY'),
        ]),
      );
    }
  });

  it('requires S3 settings only when the s3 driver is selected', () => {
    expect(() => loadEnv({ ...TEST_ENV, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    const env = loadEnv({
      ...TEST_ENV,
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'bucket',
      S3_REGION: 'auto',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(env.STORAGE_DRIVER).toBe('s3');
  });

  it('rejects a non-postgres database url', () => {
    expect(() => loadEnv({ ...TEST_ENV, DATABASE_URL: 'mysql://localhost/x' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
