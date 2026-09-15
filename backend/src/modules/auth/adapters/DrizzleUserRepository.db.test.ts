import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../../../domain/errors/index.js';
import type { Database } from '../../../infrastructure/db/client.js';
import { DrizzleCollectionRepository } from '../../collections/adapters/DrizzleCollectionRepository.js';
import { DrizzleImageRepository } from '../../images/adapters/DrizzleImageRepository.js';
import { DrizzleItemRepository } from '../../items/adapters/DrizzleItemRepository.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleUserRepository (postgres)', () => {
  let database: Database;
  let repository: DrizzleUserRepository;

  beforeAll(async () => {
    database = await connectTestDatabase();
    repository = new DrizzleUserRepository(database.db);
  });

  beforeEach(() => truncateAll(database.db));
  afterAll(() => database.close());

  const input = { email: 'linus@example.com', displayName: 'Linus', passwordHash: 'hash' };

  it('creates a user and finds it by id and by email', async () => {
    const created = await repository.create(input);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeInstanceOf(Date);

    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByEmail('linus@example.com')).toEqual(created);
  });

  it('updates the profile, and deleting the account takes its boards and saves with it', async () => {
    const user = await repository.create({
      email: 'u@x.com',
      displayName: 'Uma',
      passwordHash: 'h',
    });
    expect((await repository.update(user.id, { bio: 'Hello' })).bio).toBe('Hello');

    const collections = new DrizzleCollectionRepository(database.db);
    const other = await repository.create({
      email: 'o@x.com',
      displayName: 'Ola',
      passwordHash: 'h',
    });
    const draft = { description: '', visibility: 'private' as const };
    const own = await collections.create({ ...draft, ownerId: user.id, title: 'Mine' });
    const theirs = await collections.create({ ...draft, ownerId: other.id, title: 'Theirs' });
    const image = await new DrizzleImageRepository(database.db).create({
      provider: 'pixabay',
      providerImageId: 'z',
      storageKey: 'images/z.jpg',
      width: 10,
      height: 10,
      blurhash: null,
      palette: [],
      tags: [],
      credit: { name: 'n', url: null },
      sourceUrl: 'https://x.test/z',
    });
    const items = new DrizzleItemRepository(database.db);
    await items.create({
      collectionId: theirs.id,
      imageId: image.id,
      addedById: user.id,
      caption: '',
      tags: [],
      position: 0,
    });

    await repository.delete(user.id);
    expect(await repository.findById(user.id)).toBeNull();
    expect(await collections.findById(own.id)).toBeNull();
    expect(await items.listByCollection(theirs.id)).toEqual([]);
    expect(await collections.findById(theirs.id)).not.toBeNull();
  });

  it('returns null for unknown users', async () => {
    expect(await repository.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
  });

  it('maps the unique email constraint to ConflictError', async () => {
    await repository.create(input);
    await expect(repository.create({ ...input, displayName: 'Other' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
