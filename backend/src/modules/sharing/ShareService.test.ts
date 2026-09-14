import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  InvalidOperationError,
  NotFoundError,
} from '../../domain/errors/index.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { RecordingEventBus } from '../../testing/fakes/RecordingEventBus.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { CollectionService } from '../collections/CollectionService.js';
import { ShareService } from './ShareService.js';

describe('ShareService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let events: RecordingEventBus;
  let collections: CollectionService;
  let share: ShareService;
  let owner: string;
  let friend: string;
  let stranger: string;
  let boardId: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    events = new RecordingEventBus();
    collections = new CollectionService({ ...repos, events, logger: silentLogger });
    share = new ShareService({ ...repos, collectionService: collections, events, logger: silentLogger });
    const user = (email: string) =>
      repos.users.create({ email, displayName: email.split('@')[0] ?? '', passwordHash: 'h' });
    owner = (await user('owner@x.com')).id;
    friend = (await user('friend@x.com')).id;
    stranger = (await user('stranger@x.com')).id;
    boardId = (await collections.create(owner, { title: 'Board', description: '', visibility: 'private' })).id;
  });

  it('creates an idempotent link that opens a private board to anyone', async () => {
    await expect(share.createLink(boardId, stranger)).rejects.toBeInstanceOf(ForbiddenError);

    const slug = await share.createLink(boardId, owner);
    expect(slug).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(await share.createLink(boardId, owner)).toBe(slug);
    expect((await repos.collections.findById(boardId))?.visibility).toBe('unlisted');

    const opened = await share.openLink(slug, null);
    expect(opened.summary).toMatchObject({ id: boardId, role: null, visibility: 'unlisted' });
    await expect(share.openLink('nope', null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('revoking returns an unlisted board to private but leaves public boards public', async () => {
    const slug = await share.createLink(boardId, owner);
    await share.revokeLink(boardId, owner);
    expect(await repos.collections.findById(boardId)).toMatchObject({ shareSlug: null, visibility: 'private' });
    await expect(share.openLink(slug, null)).rejects.toBeInstanceOf(NotFoundError);

    await collections.update(boardId, owner, { visibility: 'public' });
    await share.createLink(boardId, owner);
    expect((await repos.collections.findById(boardId))?.visibility).toBe('public');
    await share.revokeLink(boardId, owner);
    expect((await repos.collections.findById(boardId))?.visibility).toBe('public');
  });

  it('invites accounts by email and announces it', async () => {
    const member = await share.invite(boardId, owner, 'friend@x.com', 'editor');
    expect(member).toMatchObject({ userId: friend, role: 'editor', displayName: 'friend', email: 'friend@x.com' });
    expect(events.names()).toEqual(['member.added']);

    await expect(share.invite(boardId, owner, 'friend@x.com', 'viewer')).rejects.toBeInstanceOf(ConflictError);
    await expect(share.invite(boardId, owner, 'ghost@x.com', 'viewer')).rejects.toBeInstanceOf(NotFoundError);
    await expect(share.invite(boardId, friend, 'stranger@x.com', 'viewer')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('shows the member list to members only', async () => {
    await share.invite(boardId, owner, 'friend@x.com', 'viewer');
    expect((await share.listMembers(boardId, friend)).map((m) => m.role)).toEqual(['owner', 'viewer']);
    await expect(share.listMembers(boardId, stranger)).rejects.toBeInstanceOf(ForbiddenError);

    await collections.update(boardId, owner, { visibility: 'public' });
    await expect(share.listMembers(boardId, stranger)).rejects.toThrow(/Only members/);
  });

  it('changes roles for everyone but the owner', async () => {
    await share.invite(boardId, owner, 'friend@x.com', 'editor');
    expect((await share.updateRole(boardId, owner, friend, 'viewer')).role).toBe('viewer');
    await expect(share.updateRole(boardId, owner, owner, 'viewer')).rejects.toBeInstanceOf(InvalidOperationError);
    await expect(share.updateRole(boardId, friend, friend, 'editor')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets owners remove members and members leave, but never removes the owner', async () => {
    await share.invite(boardId, owner, 'friend@x.com', 'editor');
    await expect(share.removeMember(boardId, stranger, friend)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(share.removeMember(boardId, owner, owner)).rejects.toBeInstanceOf(InvalidOperationError);

    await share.removeMember(boardId, friend, friend);
    expect(await repos.memberships.find(boardId, friend)).toBeNull();
    await expect(share.removeMember(boardId, owner, friend)).rejects.toBeInstanceOf(NotFoundError);

    await share.invite(boardId, owner, 'friend@x.com', 'editor');
    await share.removeMember(boardId, owner, friend);
    expect(await repos.memberships.listMemberIds(boardId)).toEqual([owner]);
  });
});
