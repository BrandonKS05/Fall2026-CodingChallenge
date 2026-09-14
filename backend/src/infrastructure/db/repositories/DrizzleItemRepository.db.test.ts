import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type { NewImage } from '../../../ports/repositories/ImageRepository.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';
import type { Database } from '../client.js';
import { DrizzleCollectionRepository } from './DrizzleCollectionRepository.js';
import { DrizzleImageRepository } from './DrizzleImageRepository.js';
import { DrizzleItemRepository } from './DrizzleItemRepository.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleItemRepository (postgres)', () => {
  let database: Database;
  let items: DrizzleItemRepository;
  let collections: DrizzleCollectionRepository;
  let userId: string;
  let boardId: string;
  let imageA: string;
  let imageB: string;

  const imageInput = (providerImageId: string): NewImage => ({
    provider: 'pixabay',
    providerImageId,
    storageKey: `images/${providerImageId}.jpg`,
    width: 100,
    height: 50,
    blurhash: null,
    palette: [],
    tags: ['tag'],
    credit: { name: 'n', url: null },
    sourceUrl: 'https://x.test/p',
  });

  beforeAll(async () => {
    database = await connectTestDatabase();
    items = new DrizzleItemRepository(database.db);
    collections = new DrizzleCollectionRepository(database.db);
  });

  beforeEach(async () => {
    await truncateAll(database.db);
    userId = (await new DrizzleUserRepository(database.db).create({ email: 'u@x.com', displayName: 'Uma', passwordHash: 'h' })).id;
    boardId = (await collections.create({ ownerId: userId, title: 'B', description: '', visibility: 'private' })).id;
    const images = new DrizzleImageRepository(database.db);
    imageA = (await images.create(imageInput('a'))).id;
    imageB = (await images.create(imageInput('b'))).id;
  });

  afterAll(() => database.close());

  const newItem = (imageId: string, position: number, collectionId = boardId) => ({
    collectionId,
    imageId,
    addedById: userId,
    caption: 'c',
    tags: ['t'],
    position,
  });

  it('appends positions and lists items with their image and adder', async () => {
    expect(await items.nextPosition(boardId)).toBe(0);
    const a = await items.create(newItem(imageA, await items.nextPosition(boardId)));
    const b = await items.create(newItem(imageB, await items.nextPosition(boardId)));
    expect([a.position, b.position]).toEqual([0, 1]);

    const listed = await items.listByCollection(boardId);
    expect(listed.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(listed[0]).toMatchObject({ image: { providerImageId: 'a', tags: ['tag'] }, addedBy: { id: userId, displayName: 'Uma' } });
    expect(await items.findDetail(b.id)).toMatchObject({ image: { id: imageB } });
    expect(await items.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('keeps an image unique per board, including on moves', async () => {
    const a = await items.create(newItem(imageA, 0));
    await expect(items.create(newItem(imageA, 1))).rejects.toBeInstanceOf(ConflictError);

    const other = (await collections.create({ ownerId: userId, title: 'O', description: '', visibility: 'private' })).id;
    await items.create(newItem(imageA, 0, other));
    await expect(items.update(a.id, { collectionId: other })).rejects.toBeInstanceOf(ConflictError);

    const b = await items.create(newItem(imageB, 1));
    const moved = await items.update(b.id, { collectionId: other, position: 5 });
    expect(moved).toMatchObject({ collectionId: other, position: 5 });
  }, 10_000);

  it('updates, deletes, and cascades with the board', async () => {
    const a = await items.create(newItem(imageA, 0));
    const updated = await items.update(a.id, { caption: 'new', tags: ['x', 'y'] });
    expect(updated).toMatchObject({ caption: 'new', tags: ['x', 'y'] });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(a.updatedAt.getTime());
    await expect(items.update('00000000-0000-0000-0000-000000000000', { caption: 'x' })).rejects.toBeInstanceOf(NotFoundError);

    await items.delete(a.id);
    expect(await items.findById(a.id)).toBeNull();

    await items.create(newItem(imageB, 0));
    await collections.delete(boardId);
    expect(await items.listByCollection(boardId)).toEqual([]);
    expect(await new DrizzleImageRepository(database.db).findById(imageB)).not.toBeNull();
  });
});
