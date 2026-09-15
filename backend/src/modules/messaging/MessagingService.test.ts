import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, InvalidOperationError, NotFoundError } from '../../domain/errors/index.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { RecordingBroadcaster } from '../../testing/fakes/RecordingBroadcaster.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { MessagingService } from './MessagingService.js';

describe('MessagingService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let broadcaster: RecordingBroadcaster;
  let service: MessagingService;
  let ada: string;
  let sam: string;
  let stranger: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    broadcaster = new RecordingBroadcaster();
    service = new MessagingService({
      conversations: repos.conversations,
      messages: repos.messages,
      users: repos.users,
      follows: repos.follows,
      broadcaster,
      logger: silentLogger,
    });

    const user = (handle: string) =>
      repos.users.create({
        email: `${handle}@x.com`,
        handle,
        displayName: handle,
        passwordHash: 'h',
      });
    ada = (await user('ada')).id;
    sam = (await user('sam')).id;
    stranger = (await user('stranger')).id;
    // Ada and Sam follow each other, so what they send each other is not a request.
    await repos.follows.follow(ada, sam);
    await repos.follows.follow(sam, ada);
  });

  it('opens one conversation per pair, whoever asks and however often', async () => {
    const first = await service.startDirect(ada, 'sam');
    const again = await service.startDirect(ada, 'sam');
    const fromSam = await service.startDirect(sam, 'ada');

    expect(again.id).toBe(first.id);
    expect(fromSam.id).toBe(first.id);
    expect(first.participants).toEqual([{ id: sam, handle: 'sam', displayName: 'sam' }]);
    // Each side sees the other, never themselves.
    expect(fromSam.participants).toEqual([{ id: ada, handle: 'ada', displayName: 'ada' }]);
  });

  it('refuses an unknown handle and your own', async () => {
    await expect(service.startDirect(ada, 'nobody')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.startDirect(ada, 'ada')).rejects.toBeInstanceOf(InvalidOperationError);
  });

  it('delivers a message to both members and counts it unread for the other one', async () => {
    const conversation = await service.startDirect(ada, 'sam');

    const sent = await service.send(ada, conversation.id, 'Found something for you');

    expect(sent).toMatchObject({ body: 'Found something for you', sender: { handle: 'ada' } });
    expect(broadcaster.published).toHaveLength(1);
    expect(broadcaster.published[0]?.recipientIds.toSorted()).toEqual([ada, sam].toSorted());

    const samsInbox = await service.inbox(sam);
    expect(samsInbox.unreadTotal).toBe(1);
    expect(samsInbox.conversations[0]?.lastMessage?.body).toBe('Found something for you');
    // Your own message is never unread for you.
    expect((await service.inbox(ada)).unreadTotal).toBe(0);

    await service.markRead(sam, conversation.id);
    expect((await service.inbox(sam)).unreadTotal).toBe(0);
  });

  it('keeps everyone else out of a conversation they are not in', async () => {
    const conversation = await service.startDirect(ada, 'sam');

    await expect(service.send(stranger, conversation.id, 'hello?')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      service.listMessages(stranger, conversation.id, { limit: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.markRead(stranger, conversation.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await service.inbox(stranger)).toMatchObject({ conversations: [], unreadTotal: 0 });

    await expect(
      service.listMessages(ada, '00000000-0000-0000-0000-000000000000', { limit: 50 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('pages backwards through the history, oldest first within a page', async () => {
    const conversation = await service.startDirect(ada, 'sam');
    for (const line of ['one', 'two', 'three', 'four', 'five']) {
      await service.send(ada, conversation.id, line);
    }

    const newest = await service.listMessages(ada, conversation.id, { limit: 2 });
    expect(newest.messages.map((message) => message.body)).toEqual(['four', 'five']);
    expect(newest.hasMore).toBe(true);

    const older = await service.listMessages(ada, conversation.id, {
      limit: 2,
      before: newest.messages[0]?.id,
    });
    expect(older.messages.map((message) => message.body)).toEqual(['two', 'three']);
    expect(older.hasMore).toBe(true);

    const oldest = await service.listMessages(ada, conversation.id, {
      limit: 2,
      before: older.messages[0]?.id,
    });
    expect(oldest.messages.map((message) => message.body)).toEqual(['one']);
    expect(oldest.hasMore).toBe(false);
  });

  it('moves a conversation to the top of the inbox when it gets a message', async () => {
    const withSam = await service.startDirect(ada, 'sam');
    const withStranger = await service.startDirect(ada, 'stranger');
    expect((await service.inbox(ada)).conversations[0]?.id).toBe(withStranger.id);

    await service.send(sam, withSam.id, 'up top');

    expect((await service.inbox(ada)).conversations[0]?.id).toBe(withSam.id);
  });

  describe('requests', () => {
    it('lands in requests when the other person does not follow you, and rations the opener', async () => {
      const conversation = await service.startDirect(ada, 'stranger');
      expect(conversation.state).toBe('accepted');

      await service.send(ada, conversation.id, 'Hello, you do not know me');

      // Ada has said her piece and cannot say more until it is accepted.
      await expect(service.send(ada, conversation.id, 'Still there?')).rejects.toBeInstanceOf(
        InvalidOperationError,
      );

      const theirInbox = await service.inbox(stranger);
      expect(theirInbox.conversations).toEqual([]);
      expect(theirInbox.requestCount).toBe(1);
      // A stranger's message never makes the badge shout.
      expect(theirInbox.unreadTotal).toBe(0);

      const theirRequests = await service.inbox(stranger, 'requests');
      expect(theirRequests.conversations.map((row) => row.id)).toEqual([conversation.id]);
      expect(theirRequests.conversations[0]?.state).toBe('pending');
    });

    it('will not let the person who has not accepted write back', async () => {
      const conversation = await service.startDirect(ada, 'stranger');
      await service.send(ada, conversation.id, 'Hello');

      await expect(service.send(stranger, conversation.id, 'Who?')).rejects.toBeInstanceOf(
        InvalidOperationError,
      );
    });

    it('accepting moves it into the messages and opens both sides up', async () => {
      const conversation = await service.startDirect(ada, 'stranger');
      await service.send(ada, conversation.id, 'Hello');

      const accepted = await service.accept(stranger, conversation.id);
      expect(accepted.state).toBe('accepted');

      expect((await service.inbox(stranger)).conversations.map((row) => row.id)).toEqual([
        conversation.id,
      ]);
      expect(await service.inbox(stranger, 'requests')).toMatchObject({
        conversations: [],
        requestCount: 0,
      });

      await expect(service.send(stranger, conversation.id, 'Hello back')).resolves.toMatchObject({
        body: 'Hello back',
      });
      await expect(service.send(ada, conversation.id, 'And again')).resolves.toBeDefined();
    });

    it('goes straight to the messages when the other person follows you', async () => {
      const conversation = await service.startDirect(ada, 'sam');
      await service.send(ada, conversation.id, 'One');
      await service.send(ada, conversation.id, 'Two');

      const samsInbox = await service.inbox(sam);
      expect(samsInbox.conversations.map((row) => row.id)).toEqual([conversation.id]);
      expect(samsInbox.requestCount).toBe(0);
      expect(samsInbox.unreadTotal).toBe(2);
    });
  });
});
