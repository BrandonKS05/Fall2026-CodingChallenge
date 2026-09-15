import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../infrastructure/db/client.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';
import { DrizzleUserRepository } from '../../auth/adapters/DrizzleUserRepository.js';
import { DrizzleFollowRepository } from './DrizzleFollowRepository.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleFollowRepository (postgres)', () => {
  let database: Database;
  let follows: DrizzleFollowRepository;
  let users: DrizzleUserRepository;
  let ada: string;
  let sam: string;
  let grace: string;

  beforeAll(async () => {
    database = await connectTestDatabase();
    follows = new DrizzleFollowRepository(database.db);
    users = new DrizzleUserRepository(database.db);
  });

  beforeEach(async () => {
    await truncateAll(database.db);
    const user = (handle: string) =>
      users.create({ email: `${handle}@x.com`, handle, displayName: handle, passwordHash: 'h' });
    ada = (await user('ada')).id;
    sam = (await user('sam')).id;
    grace = (await user('grace')).id;
  });

  afterAll(() => database.close());

  it('records a follow once, and says whether anything changed', async () => {
    expect(await follows.follow(sam, ada)).toBe(true);
    expect(await follows.follow(sam, ada)).toBe(false);
    expect(await follows.isFollowing(sam, ada)).toBe(true);
    // Following is one-way until it is returned.
    expect(await follows.isFollowing(ada, sam)).toBe(false);

    expect(await follows.unfollow(sam, ada)).toBe(true);
    expect(await follows.unfollow(sam, ada)).toBe(false);
  });

  it('counts both directions for one person', async () => {
    await follows.follow(sam, ada);
    await follows.follow(grace, ada);
    await follows.follow(ada, grace);

    expect(await follows.counts(ada)).toEqual({ followers: 2, following: 1 });
    expect(await follows.counts(sam)).toEqual({ followers: 0, following: 1 });
  });

  it('lists each direction newest first, flagging who the viewer follows', async () => {
    await follows.follow(sam, ada);
    await follows.follow(grace, ada);
    await follows.follow(ada, grace);

    const forAda = await follows.listFollowers(ada, { limit: 50, viewerId: ada });
    expect(forAda.map((profile) => profile.handle)).toEqual(['grace', 'sam']);
    expect(forAda.map((profile) => profile.followedByViewer)).toEqual([true, false]);
    expect(forAda[0]).toMatchObject({ id: grace, displayName: 'grace', bio: '' });

    // A visitor sees the same people and follows none of them.
    const forVisitor = await follows.listFollowers(ada, { limit: 50, viewerId: null });
    expect(forVisitor.every((profile) => !profile.followedByViewer)).toBe(true);

    expect(await follows.listFollowing(ada, { limit: 50, viewerId: null })).toMatchObject([
      { handle: 'grace' },
    ]);
    expect(await follows.listFollowers(ada, { limit: 1, viewerId: null })).toHaveLength(1);
  });

  it('forgets the edges of an account that leaves', async () => {
    await follows.follow(sam, ada);
    await follows.follow(ada, grace);

    await users.delete(ada);

    expect(await follows.counts(sam)).toEqual({ followers: 0, following: 0 });
    expect(await follows.counts(grace)).toEqual({ followers: 0, following: 0 });
  });
});
