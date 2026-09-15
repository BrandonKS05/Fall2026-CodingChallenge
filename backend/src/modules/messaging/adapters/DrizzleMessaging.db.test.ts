import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../infrastructure/db/client.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from '../../../testing/testDatabase.js';
import { DrizzleUserRepository } from '../../auth/adapters/DrizzleUserRepository.js';
import { DrizzleConversationRepository } from './DrizzleConversationRepository.js';
import { DrizzleMessageRepository } from './DrizzleMessageRepository.js';

describe.skipIf(!RUN_DB_TESTS)('messaging repositories (postgres)', () => {
  let database: Database;
  let conversations: DrizzleConversationRepository;
  let messages: DrizzleMessageRepository;
  let users: DrizzleUserRepository;
  let ada: string;
  let sam: string;

  beforeAll(async () => {
    database = await connectTestDatabase();
    conversations = new DrizzleConversationRepository(database.db);
    messages = new DrizzleMessageRepository(database.db);
    users = new DrizzleUserRepository(database.db);
  });

  beforeEach(async () => {
    await truncateAll(database.db);
    const user = (handle: string) =>
      users.create({ email: `${handle}@x.com`, handle, displayName: handle, passwordHash: 'h' });
    ada = (await user('ada')).id;
    sam = (await user('sam')).id;
  });

  afterAll(() => database.close());

  const say = (conversationId: string, senderId: string, body: string) =>
    messages.create({ conversationId, senderId, body });

  it('keeps one direct conversation per pair, whichever way round it is asked for', async () => {
    const created = await conversations.createDirect(ada, sam, 'accepted');
    expect(await conversations.findDirect(sam, ada)).toMatchObject({ id: created.id });
    expect((await conversations.memberIds(created.id)).toSorted()).toEqual([ada, sam].toSorted());
    expect(await conversations.isMember(created.id, ada)).toBe(true);

    // The unique key is the guarantee: a second attempt returns the first conversation.
    expect(await conversations.createDirect(sam, ada, 'accepted')).toMatchObject({
      id: created.id,
    });
  });

  it('summarizes what each side sees: the other person, the last line, their own unread count', async () => {
    const conversation = await conversations.createDirect(ada, sam, 'accepted');
    await say(conversation.id, ada, 'first');
    await say(conversation.id, ada, 'second');
    await conversations.touch(conversation.id);

    const [forSam] = await conversations.listForUser(sam, 'accepted');
    expect(forSam).toMatchObject({
      id: conversation.id,
      participants: [{ id: ada, handle: 'ada' }],
      unreadCount: 2,
    });
    expect(forSam?.lastMessage).toMatchObject({ body: 'second', senderId: ada });
    expect(forSam?.lastMessage?.createdAt).toBeInstanceOf(Date);

    // Your own messages are never unread for you.
    expect((await conversations.listForUser(ada, 'accepted'))[0]?.unreadCount).toBe(0);

    await conversations.markRead(conversation.id, sam);
    expect((await conversations.listForUser(sam, 'accepted'))[0]?.unreadCount).toBe(0);
  });

  it('orders the inbox by the last message and hides conversations you are not in', async () => {
    const withSam = await conversations.createDirect(ada, sam, 'accepted');
    const nosy = (
      await users.create({
        email: 'n@x.com',
        handle: 'nosy',
        displayName: 'Nosy',
        passwordHash: 'h',
      })
    ).id;
    const withNosy = await conversations.createDirect(ada, nosy, 'accepted');

    await say(withSam.id, sam, 'over here');
    await conversations.touch(withSam.id);

    expect((await conversations.listForUser(ada, 'accepted')).map((row) => row.id)).toEqual([
      withSam.id,
      withNosy.id,
    ]);
    expect(await conversations.listForUser(nosy, 'accepted')).toHaveLength(1);
    expect(await conversations.findSummary(withSam.id, nosy)).toBeNull();
  });

  it('pages backwards through history and reports whether more is behind it', async () => {
    const conversation = await conversations.createDirect(ada, sam, 'accepted');
    for (const line of ['one', 'two', 'three', 'four', 'five']) {
      await say(conversation.id, ada, line);
    }

    const newest = await messages.listByConversation(conversation.id, { limit: 2 });
    expect(newest.messages.map((message) => message.body)).toEqual(['four', 'five']);
    expect(newest.hasMore).toBe(true);
    expect(newest.messages[0]?.sender).toMatchObject({ handle: 'ada', displayName: 'ada' });

    const older = await messages.listByConversation(conversation.id, {
      limit: 2,
      before: newest.messages[0]?.id,
    });
    expect(older.messages.map((message) => message.body)).toEqual(['two', 'three']);

    const oldest = await messages.listByConversation(conversation.id, {
      limit: 2,
      before: older.messages[0]?.id,
    });
    expect(oldest.messages.map((message) => message.body)).toEqual(['one']);
    expect(oldest.hasMore).toBe(false);
  });

  it('takes the conversation and its messages with the account that leaves', async () => {
    const conversation = await conversations.createDirect(ada, sam, 'accepted');
    await say(conversation.id, ada, 'still here?');

    await users.delete(ada);

    expect(await messages.listByConversation(conversation.id, { limit: 10 })).toMatchObject({
      messages: [],
    });
    expect(await conversations.memberIds(conversation.id)).toEqual([sam]);
  });
});
