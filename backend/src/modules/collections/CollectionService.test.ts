import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Image } from '../../domain/entities/Image.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors/index.js';
import { CollectionService } from './CollectionService.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { RecordingEventBus } from '../../testing/fakes/RecordingEventBus.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';

describe('CollectionService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: CollectionService;
  let ownerId: string;
  let otherId: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    service = new CollectionService({
      ...repos,
      events: new RecordingEventBus(),
      logger: silentLogger,
    });
    ownerId = (
      await repos.users.create({ email: 'o@x.com', displayName: 'Owner', passwordHash: 'h' })
    ).id;
    otherId = (
      await repos.users.create({ email: 'e@x.com', displayName: 'Else', passwordHash: 'h' })
    ).id;
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

    await expect(service.update(board.id, otherId, { title: 'x' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
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

    await expect(service.authorize(board.id, otherId, 'edit')).resolves.toMatchObject({
      role: 'editor',
    });
    await expect(service.authorize(board.id, otherId, 'manage')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.authorize(board.id, null, 'view')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.authorize('00000000-0000-0000-0000-000000000000', ownerId, 'view'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  describe('listPublicImages', () => {
    afterEach(() => vi.useRealTimers());

    /** Fake timers give every write a distinct, ordered timestamp. */
    async function later<T>(work: () => Promise<T>): Promise<T> {
      vi.advanceTimersByTime(1_000);
      return work();
    }

    async function storeImage(providerImageId: string): Promise<Image> {
      return later(() =>
        repos.images.create({
          provider: 'pixabay',
          providerImageId,
          storageKey: `images/${providerImageId}.jpg`,
          width: 1600,
          height: 1200,
          blurhash: null,
          palette: [],
          tags: [],
          credit: { name: 'photographer', url: null },
          sourceUrl: `https://pixabay.com/photos/${providerImageId}/`,
        }),
      );
    }

    async function addTo(collectionId: string, image: Image): Promise<void> {
      await later(async () =>
        repos.items.create({
          collectionId,
          imageId: image.id,
          addedById: ownerId,
          caption: '',
          tags: [],
          position: await repos.items.nextPosition(collectionId),
        }),
      );
    }

    it('interleaves public boards newest-first, lists each image once, and skips other boards', async () => {
      vi.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });
      const a = await later(() =>
        service.create(ownerId, { ...draft, title: 'A', visibility: 'public' }),
      );
      const b = await later(() =>
        service.create(ownerId, { ...draft, title: 'B', visibility: 'public' }),
      );
      const c = await later(() =>
        service.create(ownerId, { ...draft, title: 'C', visibility: 'unlisted' }),
      );
      const [x, y, z, w, v] = await Promise.all(['x', 'y', 'z', 'w', 'v'].map(storeImage));
      if (!x || !y || !z || !w || !v) throw new Error('fixtures');

      await addTo(a.id, x);
      await addTo(a.id, y);
      await addTo(a.id, z);
      await addTo(b.id, y); // the same image on two public boards
      await addTo(b.id, w);
      await addTo(c.id, v);
      await later(() => repos.collections.touch(a.id)); // A is the most recently updated board

      const feed = await service.listPublicImages(10);
      expect(feed.map((row) => row.image.providerImageId)).toEqual(['z', 'w', 'y', 'x']);
      expect(feed.map((row) => row.collectionTitle)).toEqual(['A', 'B', 'A', 'A']);
      expect(feed[0]?.collectionId).toBe(a.id);
      expect(feed[0]?.image).toEqual(z);

      // Round-robin survives the cap: the second slot goes to B's newest, not A's second.
      expect((await service.listPublicImages(2)).map((row) => row.image.providerImageId)).toEqual([
        'z',
        'w',
      ]);
    });

    it('keeps a board in the lead round when its newest image was claimed by a newer board', async () => {
      vi.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });
      const a = await later(() =>
        service.create(ownerId, { ...draft, title: 'A', visibility: 'public' }),
      );
      const b = await later(() =>
        service.create(ownerId, { ...draft, title: 'B', visibility: 'public' }),
      );
      const [x, y, z, w] = await Promise.all(['x', 'y', 'z', 'w'].map(storeImage));
      if (!x || !y || !z || !w) throw new Error('fixtures');

      await addTo(a.id, x);
      await addTo(a.id, y);
      await addTo(a.id, z); // A's newest...
      await addTo(b.id, w);
      await addTo(b.id, z); // ...is also B's newest, and B is the newer board
      await later(() => repos.collections.touch(b.id));

      const feed = await service.listPublicImages(10);
      // Z goes to B; A's newest surviving image (Y) still leads for A instead of dropping a round.
      expect(feed.map((row) => row.image.providerImageId)).toEqual(['z', 'y', 'w', 'x']);
      expect(feed.map((row) => row.collectionTitle)).toEqual(['B', 'A', 'B', 'A']);
    });

    it('is empty without public boards', async () => {
      await service.create(ownerId, draft);
      expect(await service.listPublicImages(10)).toEqual([]);
    });
  });
});
