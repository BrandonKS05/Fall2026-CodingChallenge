import { DEFAULT_USER_PREFERENCES } from '@wumboo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEvent } from '../../domain/events/index.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { RecordingEventBus } from '../../testing/fakes/RecordingEventBus.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { NotificationService } from './NotificationService.js';

describe('NotificationService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: NotificationService;
  let owner: string;
  let editor: string;
  let viewer: string;
  let boardId: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    service = new NotificationService({
      notifications: repos.notifications,
      memberships: repos.memberships,
      users: repos.users,
      logger: silentLogger,
    });
    const user = (email: string) =>
      repos.users.create({ email, displayName: email.split('@')[0] ?? '', passwordHash: 'h' });
    owner = (await user('owner@x.com')).id;
    editor = (await user('editor@x.com')).id;
    viewer = (await user('viewer@x.com')).id;
    boardId = (
      await repos.collections.create({
        ownerId: owner,
        title: 'Kitchens',
        description: '',
        visibility: 'private',
      })
    ).id;
    await repos.memberships.add({ collectionId: boardId, userId: editor, role: 'editor' });
    await repos.memberships.add({ collectionId: boardId, userId: viewer, role: 'viewer' });
  });

  it('notifies every member except the actor, with the event details', async () => {
    await service.handle(
      createEvent('item.added', {
        collectionId: boardId,
        actorId: editor,
        itemId: 'i1',
        imageId: 'img1',
      }),
    );

    const ownerInbox = await service.inbox(owner);
    expect(ownerInbox.unreadCount).toBe(1);
    expect(ownerInbox.notifications[0]).toMatchObject({
      type: 'item_added',
      actorDisplayName: 'editor',
      collectionTitle: 'Kitchens',
      payload: { itemId: 'i1', imageId: 'img1' },
      readAt: null,
    });
    expect((await service.inbox(viewer)).unreadCount).toBe(1);
    expect((await service.inbox(editor)).unreadCount).toBe(0);
  });

  it('writes nothing for a member who has that kind of notification switched off', async () => {
    await repos.users.update(viewer, {
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        notifications: { ...DEFAULT_USER_PREFERENCES.notifications, itemAdded: false },
      },
    });

    await service.handle(
      createEvent('item.added', {
        collectionId: boardId,
        actorId: owner,
        itemId: 'i1',
        imageId: 'img1',
      }),
    );

    expect((await service.inbox(editor)).notifications).toHaveLength(1);
    expect((await service.inbox(viewer)).notifications).toEqual([]);

    // Another kind still reaches them: the switch is per kind, not a blanket mute.
    await service.handle(
      createEvent('collection.updated', {
        collectionId: boardId,
        actorId: owner,
        changes: ['title'],
      }),
    );
    expect((await service.inbox(viewer)).notifications).toHaveLength(1);
  });

  it('marks some or all notifications read', async () => {
    for (const itemId of ['a', 'b']) {
      await service.handle(
        createEvent('item.added', { collectionId: boardId, actorId: editor, itemId, imageId: 'x' }),
      );
    }
    const inbox = await service.inbox(owner);
    expect(inbox.unreadCount).toBe(2);
    expect(inbox.notifications.map((n) => n.payload.itemId)).toEqual(['b', 'a']);

    await service.markRead(owner, [inbox.notifications[0]?.id ?? '']);
    expect((await service.inbox(owner)).unreadCount).toBe(1);
    await service.markRead(owner);
    expect((await service.inbox(owner)).unreadCount).toBe(0);
    expect((await service.inbox(viewer)).unreadCount).toBe(2);
  });

  it('reacts to bus events once registered, including telling an invitee', async () => {
    const bus = new RecordingEventBus();
    service.register(bus);
    await bus.publish(
      createEvent('member.added', {
        collectionId: boardId,
        actorId: owner,
        userId: viewer,
        role: 'viewer',
      }),
    );
    const viewerInbox = await service.inbox(viewer);
    expect(viewerInbox.notifications[0]).toMatchObject({
      type: 'member_added',
      payload: { userId: viewer, role: 'viewer' },
    });
    expect((await service.inbox(owner)).unreadCount).toBe(0);
  });
});
