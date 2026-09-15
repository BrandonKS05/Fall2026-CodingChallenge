import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type { Database } from '../../../infrastructure/db/client.js';
import { DrizzleCollectionRepository } from './DrizzleCollectionRepository.js';
import { DrizzleMembershipRepository } from './DrizzleMembershipRepository.js';
import { DrizzleUserRepository } from '../../auth/adapters/DrizzleUserRepository.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';

describe.skipIf(!RUN_DB_TESTS)(
  'DrizzleCollectionRepository + DrizzleMembershipRepository (postgres)',
  () => {
    let database: Database;
    let users: DrizzleUserRepository;
    let collections: DrizzleCollectionRepository;
    let memberships: DrizzleMembershipRepository;
    let ownerId: string;
    let otherId: string;

    beforeAll(async () => {
      database = await connectTestDatabase();
      users = new DrizzleUserRepository(database.db);
      collections = new DrizzleCollectionRepository(database.db);
      memberships = new DrizzleMembershipRepository(database.db);
    });

    beforeEach(async () => {
      await truncateAll(database.db);
      ownerId = (
        await users.create({ email: 'owner@x.com', displayName: 'Owner', passwordHash: 'h' })
      ).id;
      otherId = (
        await users.create({ email: 'other@x.com', displayName: 'Other', passwordHash: 'h' })
      ).id;
    });

    afterAll(() => database.close());

    const draft = { title: 'Board', description: 'd', visibility: 'private' as const };

    it('creates a board together with its owner membership', async () => {
      const board = await collections.create({ ...draft, ownerId });
      expect(board.shareSlug).toBeNull();
      expect(await memberships.find(board.id, ownerId)).toMatchObject({ role: 'owner' });
      expect(await collections.findById(board.id)).toEqual(board);
    });

    it('builds summaries with owner name, counts, and the viewer role', async () => {
      const board = await collections.create({ ...draft, ownerId });

      const asOwner = await collections.findSummary(board.id, ownerId);
      expect(asOwner).toMatchObject({
        ownerDisplayName: 'Owner',
        itemCount: 0,
        previewImageIds: [],
        role: 'owner',
      });

      const asStranger = await collections.findSummary(board.id, otherId);
      expect(asStranger?.role).toBeNull();
      const anonymous = await collections.findSummary(board.id, null);
      expect(anonymous?.role).toBeNull();
      expect(
        await collections.findSummary('00000000-0000-0000-0000-000000000000', null),
      ).toBeNull();
    });

    it("lists a user's own and shared boards, newest first", async () => {
      const first = await collections.create({ ...draft, title: 'first', ownerId });
      const theirs = await collections.create({ ...draft, title: 'theirs', ownerId: otherId });
      await collections.create({ ...draft, title: 'not shared', ownerId: otherId });
      await memberships.add({ collectionId: theirs.id, userId: ownerId, role: 'viewer' });
      await collections.touch(first.id);

      const mine = await collections.listForUser(ownerId);
      expect(mine.map((b) => b.title)).toEqual(['first', 'theirs']);
      expect(mine.map((b) => b.role)).toEqual(['owner', 'viewer']);
    });

    it('lists public boards with pagination and the viewer role', async () => {
      const a = await collections.create({ ...draft, title: 'A', visibility: 'public', ownerId });
      await collections.create({ ...draft, title: 'B', visibility: 'public', ownerId: otherId });
      await collections.create({ ...draft, title: 'C', visibility: 'unlisted', ownerId });
      await collections.touch(a.id);

      const page = await collections.listPublic({ limit: 1, offset: 0, viewerId: ownerId });
      expect(page.map((b) => b.title)).toEqual(['A']);
      expect(page[0]?.role).toBe('owner');
      const rest = await collections.listPublic({ limit: 10, offset: 1 });
      expect(rest.map((b) => b.title)).toEqual(['B']);
      expect(rest[0]?.role).toBeNull();
    });

    it('updates, sets unique share slugs, and reports missing boards', async () => {
      const board = await collections.create({ ...draft, ownerId });
      const updated = await collections.update(board.id, { title: 'New', visibility: 'public' });
      expect(updated).toMatchObject({ title: 'New', visibility: 'public', description: 'd' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(board.updatedAt.getTime());

      await collections.setShareSlug(board.id, 'abc123');
      expect((await collections.findByShareSlug('abc123'))?.id).toBe(board.id);
      const second = await collections.create({ ...draft, ownerId });
      await expect(collections.setShareSlug(second.id, 'abc123')).rejects.toBeInstanceOf(
        ConflictError,
      );
      await collections.setShareSlug(board.id, null);
      expect(await collections.findByShareSlug('abc123')).toBeNull();

      const missing = '00000000-0000-0000-0000-000000000000';
      await expect(collections.update(missing, { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('deleting a board cascades to its memberships', async () => {
      const board = await collections.create({ ...draft, ownerId });
      await memberships.add({ collectionId: board.id, userId: otherId, role: 'editor' });
      await collections.delete(board.id);
      expect(await collections.findById(board.id)).toBeNull();
      expect(await memberships.listMemberIds(board.id)).toEqual([]);
    });

    it('manages memberships with owner-first ordering and conflict detection', async () => {
      const board = await collections.create({ ...draft, ownerId });
      await memberships.add({ collectionId: board.id, userId: otherId, role: 'viewer' });
      await expect(
        memberships.add({ collectionId: board.id, userId: otherId, role: 'editor' }),
      ).rejects.toBeInstanceOf(ConflictError);

      expect((await memberships.updateRole(board.id, otherId, 'editor')).role).toBe('editor');
      const members = await memberships.listByCollection(board.id);
      expect(members.map((m) => [m.displayName, m.role])).toEqual([
        ['Owner', 'owner'],
        ['Other', 'editor'],
      ]);
      expect(members[1]?.email).toBe('other@x.com');

      await memberships.remove(board.id, otherId);
      expect(await memberships.listMemberIds(board.id)).toEqual([ownerId]);
      await expect(memberships.updateRole(board.id, otherId, 'viewer')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  },
);
