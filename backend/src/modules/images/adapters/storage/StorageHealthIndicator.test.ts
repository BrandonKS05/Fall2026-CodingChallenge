import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../../../../testing/fakes/InMemoryStorage.js';
import { StorageHealthIndicator } from './StorageHealthIndicator.js';

describe('StorageHealthIndicator', () => {
  it('passes when a probe file round-trips, and leaves nothing behind', async () => {
    const storage = new InMemoryStorage();
    const result = await new StorageHealthIndicator(storage).check();
    expect(result.status).toBe('ok');
    expect(storage.objects.size).toBe(0);
  });

  it('fails when the backend cannot write', async () => {
    const storage = new InMemoryStorage();
    storage.put = async () => {
      throw new Error('EACCES: permission denied, mkdir /data/images');
    };
    const result = await new StorageHealthIndicator(storage).check();
    expect(result).toMatchObject({ status: 'error', message: expect.stringMatching(/EACCES/) });
  });

  it('fails when a written file cannot be read back', async () => {
    const storage = new InMemoryStorage();
    storage.get = async () => null;
    const result = await new StorageHealthIndicator(storage).check();
    expect(result).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/not readable/),
    });
    expect(storage.objects.size).toBe(0);
  });

  it('fails instead of hanging when the backend never answers', async () => {
    const storage = new InMemoryStorage();
    storage.put = () => new Promise(() => undefined);
    const result = await new StorageHealthIndicator(storage, 20).check();
    expect(result).toMatchObject({ status: 'error', message: expect.stringMatching(/Timed out/) });
  });
});
