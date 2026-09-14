import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type { NewImage } from '../../../ports/repositories/ImageRepository.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';
import type { Database } from '../client.js';
import { DrizzleImageRepository } from './DrizzleImageRepository.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleImageRepository (postgres)', () => {
  let database: Database;
  let repository: DrizzleImageRepository;

  beforeAll(async () => {
    database = await connectTestDatabase();
    repository = new DrizzleImageRepository(database.db);
  });
  beforeEach(() => truncateAll(database.db));
  afterAll(() => database.close());

  const input: NewImage = {
    provider: 'pixabay',
    providerImageId: '195893',
    storageKey: 'images/abc.jpg',
    width: 4000,
    height: 2250,
    blurhash: null,
    palette: [],
    tags: ['blossom', 'bloom'],
    credit: { name: 'Josch13', url: 'https://pixabay.com/users/Josch13-48777/' },
    sourceUrl: 'https://pixabay.com/photos/195893/',
  };

  it('stores and finds images by id and by provider id', async () => {
    const created = await repository.create(input);
    expect(created).toMatchObject({ ...input, id: expect.any(String) });
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByProviderId('pixabay', '195893')).toEqual(created);
    expect(await repository.findByProviderId('pixabay', 'other')).toBeNull();
  });

  it('enforces one row per provider image', async () => {
    await repository.create(input);
    await expect(repository.create({ ...input, storageKey: 'images/dup.jpg' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('updates enrichment fields and reports missing images', async () => {
    const created = await repository.create(input);
    const updated = await repository.update(created.id, { blurhash: 'LEHV6nWB2yk8', palette: ['#aabbcc', '#112233'] });
    expect(updated).toMatchObject({ blurhash: 'LEHV6nWB2yk8', palette: ['#aabbcc', '#112233'] });
    await expect(repository.update('00000000-0000-0000-0000-000000000000', { blurhash: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
