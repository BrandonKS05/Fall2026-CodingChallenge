import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../src/domain/errors/index.js';
import { CollectionService } from '../../src/services/CollectionService.js';
import { silentLogger } from '../fakes/fakeAuth.js';
import { createFakeRepositories } from '../helpers/fakeRepositories.js';

describe('CollectionService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: CollectionService;
  let ownerId: string;
  let otherId: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    service = new CollectionService({ ...repos, logger: silentLogger });
    ownerId = (await repos.users.create({ email: 'o@x.com', displayName: 'Owner', passwordHash: 'h' })).id;
    otherId = (await repos.users.create({ email: 'e@x.com', displayName: 'Else', passwordHash: 'h' })).id;
  });

  const draft = { title: 'Kitchens', description: '', visibility: 'private' as const };

  it('creates a board owned by the caller with an owner membership', async () => {
    const summary = await service.create(ownerId, draft);
    expect(summary.role).toBe('owner');
    expect(summary.ownerDisplayName).toBe('Owner');
    expect(await repos.memberships.find(summary.id, ownerId)).toMatchObject({ role: 'owner' });
  });

  it('hides private boards from non-members but shows unlisted and public ones', async () => {
    const board = await service.create(ownerId, draft);
    await expect(service.get(board.id, otherId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.get(board.id, null)).rejects.toBeInstanceOf(ForbiddenError);

    await service.update(board.id, ownerId, { visibility: 'unlisted' });
    expect((await service.get(board.id, null)).role).toBeNull();
    expect((await service.get(board.id, otherId)).visibility).toBe('unlisted');
  });

  it('lets only the owner update or delete', async () => {
    const board = await service.create(ownerId, draft);
    await repos.memberships.add({ collectionId: board.id, userId: otherId, role: 'editor' });

    await expect(service.update(board.id, otherId, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.delete(board.id, otherId)).rejects.toBeInstanceOf(ForbiddenError);

    expect((await service.update(board.id, ownerId, { title: 'Renamed' })).title).toBe('Renamed');
    await service.delete(board.id, ownerId);
    await expect(service.get(board.id, ownerId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists boards the user owns or was added to', async () => {
    const owned = await service.create(ownerId, draft);
    const shared = await service.create(otherId, { ...draft, title: 'Shared' });
    await repos.memberships.add({ collectionId: shared.id, userId: ownerId, role: 'viewer' });
    await service.create(otherId, { ...draft, title: 'Not mine' });

    const mine = await service.listMine(ownerId);
    expect(mine.map((b) => b.id).sort()).toEqual([owned.id, shared.id].sort());
    expect(mine.find((b) => b.id === shared.id)?.role).toBe('viewer');
  });

  it('explores only public boards with pagination', async () => {
    await service.create(ownerId, { ...draft, title: 'A', visibility: 'public' });
    await service.create(ownerId, { ...draft, title: 'B', visibility: 'public' });
    await service.create(ownerId, { ...draft, title: 'C', visibility: 'unlisted' });

    const page1 = await service.listPublic(null, { page: 1, perPage: 1 });
    const page2 = await service.listPublic(null, { page: 2, perPage: 1 });
    const page3 = await service.listPublic(null, { page: 3, perPage: 1 });
    expect(page1).toHaveLength(1);
    expect(page2).toHaveLength(1);
    expect(page3).toHaveLength(0);
    expect(page1[0]?.id).not.toBe(page2[0]?.id);
  });

  it('authorize maps levels to the policy', async () => {
    const board = await service.create(ownerId, draft);
    await repos.memberships.add({ collectionId: board.id, userId: otherId, role: 'editor' });

    await expect(service.authorize(board.id, otherId, 'edit')).resolves.toMatchObject({ role: 'editor' });
    await expect(service.authorize(board.id, otherId, 'manage')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.authorize(board.id, null, 'view')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.authorize('00000000-0000-0000-0000-000000000000', ownerId, 'view')).rejects.toBeInstanceOf(NotFoundError);
  });
});
