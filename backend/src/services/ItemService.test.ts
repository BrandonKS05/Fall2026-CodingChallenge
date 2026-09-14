import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../domain/errors/index.js';
import { silentLogger } from '../testing/fakes/fakeAuth.js';
import { createFakeFetch, FAKE_JPEG } from '../testing/fakes/fakeFetch.js';
import { FakeImageProvider, fakeProviderImage } from '../testing/fakes/FakeImageProvider.js';
import { InMemoryStorage } from '../testing/fakes/InMemoryStorage.js';
import { RecordingEventBus } from '../testing/fakes/RecordingEventBus.js';
import { createFakeRepositories } from '../testing/fakeRepositories.js';
import { CollectionService } from './CollectionService.js';
import { ImageService } from './ImageService.js';
import { ItemService } from './ItemService.js';

describe('ItemService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let collections: CollectionService;
  let service: ItemService;
  let events: RecordingEventBus;
  let owner: string;
  let editor: string;
  let viewer: string;
  let stranger: string;
  let boardId: string;

  const save = (id: string, actor: string, board = boardId) =>
    service.add(board, actor, { provider: 'pixabay', providerImageId: id, caption: '', tags: [] });

  beforeEach(async () => {
    repos = createFakeRepositories();
    events = new RecordingEventBus();
    collections = new CollectionService({ ...repos, events, logger: silentLogger });
    const imageService = new ImageService({
      images: repos.images,
      providers: { pixabay: new FakeImageProvider(['1', '2', '3'].map((id) => fakeProviderImage(id))) },
      storage: new InMemoryStorage(),
      fetchFn: createFakeFetch({
        'https://fake.test/download/1.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
        'https://fake.test/download/2.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
        'https://fake.test/download/3.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
      }),
      logger: silentLogger,
    });
    service = new ItemService({
      items: repos.items,
      collectionRepository: repos.collections,
      collectionService: collections,
      imageService,
      events,
      logger: silentLogger,
    });

    const user = (email: string) => repos.users.create({ email, displayName: email.split('@')[0] ?? '', passwordHash: 'h' });
    owner = (await user('owner@x.com')).id;
    editor = (await user('editor@x.com')).id;
    viewer = (await user('viewer@x.com')).id;
    stranger = (await user('stranger@x.com')).id;
    boardId = (await collections.create(owner, { title: 'Board', description: '', visibility: 'private' })).id;
    await repos.memberships.add({ collectionId: boardId, userId: editor, role: 'editor' });
    await repos.memberships.add({ collectionId: boardId, userId: viewer, role: 'viewer' });
  });

  it('lets editors add items, appending positions and recording who added them', async () => {
    const first = await save('1', editor);
    const second = await save('2', owner);
    expect(first).toMatchObject({ position: 0, addedBy: { displayName: 'editor' } });
    expect(first.image.tags).toEqual(['kitchen', 'wood']);
    expect(second.position).toBe(1);

    const detail = await collections.getDetail(boardId, owner);
    expect(detail.items.map((i) => i.position)).toEqual([0, 1]);
    expect(detail.summary.itemCount).toBe(2);
    expect(detail.summary.previewImageIds).toHaveLength(2);
  });

  it('blocks viewers and strangers and refuses duplicate images', async () => {
    await expect(save('1', viewer)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(save('1', stranger)).rejects.toBeInstanceOf(ForbiddenError);
    await save('1', editor);
    await expect(save('1', owner)).rejects.toBeInstanceOf(ConflictError);
  });

  it('updates captions and tags, and moves items to boards the actor can edit', async () => {
    const item = await save('1', editor);
    const updated = await service.update(boardId, item.id, editor, { caption: 'Warm wood', tags: ['wood'] });
    expect(updated).toMatchObject({ caption: 'Warm wood', tags: ['wood'], position: 0 });

    const ownersOther = (await collections.create(owner, { title: 'Other', description: '', visibility: 'private' })).id;
    await expect(service.update(boardId, item.id, editor, { collectionId: ownersOther })).rejects.toBeInstanceOf(ForbiddenError);

    await save('2', owner, ownersOther);
    const moved = await service.update(boardId, item.id, owner, { collectionId: ownersOther });
    expect(moved).toMatchObject({ collectionId: ownersOther, position: 1 });
    await expect(service.update(ownersOther, moved.id, owner, { collectionId: boardId })).resolves.toMatchObject({ collectionId: boardId });

    await save('1', owner, ownersOther);
    await expect(service.update(boardId, moved.id, owner, { collectionId: ownersOther })).rejects.toBeInstanceOf(ConflictError);
  });

  it('removes items and treats items from another board as missing', async () => {
    const item = await save('1', editor);
    await expect(service.remove(boardId, item.id, viewer)).rejects.toBeInstanceOf(ForbiddenError);

    const otherBoard = (await collections.create(owner, { title: 'Other', description: '', visibility: 'private' })).id;
    await expect(service.remove(otherBoard, item.id, owner)).rejects.toBeInstanceOf(NotFoundError);

    await service.remove(boardId, item.id, editor);
    expect((await collections.getDetail(boardId, owner)).items).toEqual([]);
  });
});
