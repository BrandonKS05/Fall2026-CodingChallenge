import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';
import type { Database } from '../../../infrastructure/db/client.js';
import { DrizzleCollectionRepository } from '../../collections/adapters/DrizzleCollectionRepository.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { DrizzleUserRepository } from '../../auth/adapters/DrizzleUserRepository.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleNotificationRepository (postgres)', () => {
  let database: Database;
  let repository: DrizzleNotificationRepository;
  let collections: DrizzleCollectionRepository;
  let actorId: string;
  let recipientId: string;
  let collectionId: string;

  beforeAll(async () => {
    database = await connectTestDatabase();
    repository = new DrizzleNotificationRepository(database.db);
    collections = new DrizzleCollectionRepository(database.db);
  });

  beforeEach(async () => {
    await truncateAll(database.db);
    const users = new DrizzleUserRepository(database.db);
    actorId = (
      await users.create({ email: 'actor@x.com', displayName: 'Actor', passwordHash: 'h' })
    ).id;
    recipientId = (
      await users.create({ email: 'r@x.com', displayName: 'Recipient', passwordHash: 'h' })
    ).id;
    collectionId = (
      await collections.create({
        ownerId: actorId,
        title: 'Board',
        description: '',
        visibility: 'private',
      })
    ).id;
  });

  afterAll(() => database.close());

  it('lists newest first with actor and board names, counts and marks unread', async () => {
    await repository.createMany([]);
    await repository.createMany([
      { recipientId, actorId, collectionId, type: 'item_added', payload: { itemId: 'a' } },
      { recipientId, actorId, collectionId, type: 'item_removed', payload: { itemId: 'b' } },
    ]);

    const listed = await repository.listForUser(recipientId, 10);
    expect(listed).toHaveLength(2);
    expect(listed[0]).toMatchObject({
      actorDisplayName: 'Actor',
      collectionTitle: 'Board',
      readAt: null,
    });
    expect(await repository.countUnread(recipientId)).toBe(2);
    expect(await repository.countUnread(actorId)).toBe(0);

    await repository.markRead(recipientId, [listed[0]?.id ?? '']);
    expect(await repository.countUnread(recipientId)).toBe(1);
    await repository.markRead(recipientId, []);
    expect(await repository.countUnread(recipientId)).toBe(1);
    await repository.markRead(recipientId);
    expect(await repository.countUnread(recipientId)).toBe(0);
    expect(await repository.listForUser(recipientId, 1)).toHaveLength(1);
  });

  it('disappears with its board', async () => {
    await repository.createMany([
      { recipientId, actorId, collectionId, type: 'collection_updated', payload: {} },
    ]);
    await collections.delete(collectionId);
    expect(await repository.listForUser(recipientId, 10)).toEqual([]);
  });
});
