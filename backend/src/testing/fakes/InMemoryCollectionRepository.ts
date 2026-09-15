import { randomUUID } from 'node:crypto';
import type {
  Collection,
  CollectionSummary,
  CollectionVisibility,
  PublicImage,
} from '../../domain/entities/Collection.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type {
  CollectionPatch,
  CollectionRepository,
  ListPublicImagesOptions,
  ListPublicOptions,
  NewCollection,
} from '../../modules/collections/ports/CollectionRepository.js';
import type { InMemoryItemRepository } from './InMemoryItemRepository.js';
import type { InMemoryLikeRepository } from './InMemoryLikeRepository.js';
import type { InMemoryMembershipRepository } from './InMemoryMembershipRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

/** Port-conformant fake. Counts and previews come from the items fake, like the SQL summary does. */
export class InMemoryCollectionRepository implements CollectionRepository {
  readonly rows = new Map<string, Collection>();

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly memberships: InMemoryMembershipRepository,
    private readonly items: InMemoryItemRepository,
    private readonly likes: InMemoryLikeRepository,
  ) {}

  async findById(id: string): Promise<Collection | null> {
    return this.rows.get(id) ?? null;
  }

  async findByShareSlug(slug: string): Promise<Collection | null> {
    return [...this.rows.values()].find((row) => row.shareSlug === slug) ?? null;
  }

  async findSummary(id: string, viewerId: string | null): Promise<CollectionSummary | null> {
    const collection = this.rows.get(id);
    return collection ? this.toSummary(collection, viewerId) : null;
  }

  async listForUser(userId: string): Promise<CollectionSummary[]> {
    const mine = [];
    for (const collection of this.newestFirst()) {
      if (await this.memberships.find(collection.id, userId)) {
        mine.push(await this.toSummary(collection, userId));
      }
    }
    return mine;
  }

  async listPublic({ limit, offset, viewerId }: ListPublicOptions): Promise<CollectionSummary[]> {
    const publicBoards = await this.discoverable(this.newestFirst());
    return Promise.all(
      publicBoards
        .slice(offset, offset + limit)
        .map((collection) => this.toSummary(collection, viewerId ?? null)),
    );
  }

  async listByOwner(
    ownerId: string,
    { viewerId, visibilities }: { viewerId: string | null; visibilities: CollectionVisibility[] },
  ): Promise<CollectionSummary[]> {
    const theirs = this.newestFirst().filter(
      (row) => row.ownerId === ownerId && visibilities.includes(row.visibility),
    );
    return Promise.all(theirs.map((collection) => this.toSummary(collection, viewerId)));
  }

  /** Public boards whose owner still wants to be found, mirroring the SQL's predicate. */
  private async discoverable(boards: Collection[]): Promise<Collection[]> {
    const open: Collection[] = [];
    for (const board of boards.filter((row) => row.visibility === 'public')) {
      const owner = await this.users.findById(board.ownerId);
      if (owner?.preferences.discoverable !== false) open.push(board);
    }
    return open;
  }

  /** Mirrors the SQL: keep each image once (newest board wins), rank the survivors per board, interleave. */
  async listPublicImages({ limit }: ListPublicImagesOptions): Promise<PublicImage[]> {
    interface Placement {
      itemId: string;
      image: PublicImage['image'];
      board: Collection;
      addedAt: Date;
    }
    const newestFirst = (a: Placement, b: Placement) =>
      b.addedAt.getTime() - a.addedAt.getTime() || a.itemId.localeCompare(b.itemId);
    const newestBoardFirst = (a: Placement, b: Placement) =>
      b.board.updatedAt.getTime() - a.board.updatedAt.getTime() || newestFirst(a, b);

    const chosen = new Map<string, Placement>();
    for (const board of await this.discoverable(this.newestFirst())) {
      for (const item of await this.items.listByCollection(board.id)) {
        const placement = { itemId: item.id, image: item.image, board, addedAt: item.createdAt };
        const current = chosen.get(item.imageId);
        if (!current || newestBoardFirst(placement, current) < 0)
          chosen.set(item.imageId, placement);
      }
    }

    const ranked: { placement: Placement; rank: number }[] = [];
    const byBoard = new Map<string, Placement[]>();
    for (const placement of chosen.values()) {
      byBoard.set(placement.board.id, [...(byBoard.get(placement.board.id) ?? []), placement]);
    }
    for (const placements of byBoard.values()) {
      placements
        .sort(newestFirst)
        .slice(0, limit)
        .forEach((placement, index) => ranked.push({ placement, rank: index + 1 }));
    }
    return ranked
      .sort((a, b) => a.rank - b.rank || newestBoardFirst(a.placement, b.placement))
      .slice(0, limit)
      .map(({ placement: { image, board } }) => ({
        image,
        collectionId: board.id,
        collectionTitle: board.title,
      }));
  }

  async create(input: NewCollection): Promise<Collection> {
    const now = new Date();
    const collection: Collection = {
      id: randomUUID(),
      ...input,
      shareSlug: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(collection.id, collection);
    await this.memberships.add({
      collectionId: collection.id,
      userId: input.ownerId,
      role: 'owner',
    });
    return collection;
  }

  async update(id: string, patch: CollectionPatch): Promise<Collection> {
    const existing = this.rows.get(id);
    if (!existing) throw new NotFoundError('Collection', id);
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const updated = { ...existing, ...defined, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async setShareSlug(id: string, slug: string | null): Promise<Collection> {
    const existing = this.rows.get(id);
    if (!existing) throw new NotFoundError('Collection', id);
    if (slug !== null && (await this.findByShareSlug(slug))) {
      throw new ConflictError('Share link is already in use');
    }
    const updated = { ...existing, shareSlug: slug };
    this.rows.set(id, updated);
    return updated;
  }

  async touch(id: string): Promise<void> {
    const existing = this.rows.get(id);
    if (existing) this.rows.set(id, { ...existing, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
    this.memberships.removeAllFor(id);
    this.items.removeAllFor(id);
  }

  private newestFirst(): Collection[] {
    return [...this.rows.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  private async toSummary(
    collection: Collection,
    viewerId: string | null,
  ): Promise<CollectionSummary> {
    const owner = await this.users.findById(collection.ownerId);
    const membership = viewerId ? await this.memberships.find(collection.id, viewerId) : null;
    const items = await this.items.listByCollection(collection.id);
    const newestFirst = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      ...collection,
      ownerHandle: owner?.handle ?? '',
      ownerDisplayName: owner?.displayName ?? '',
      itemCount: items.length,
      previewImageIds: newestFirst.slice(0, 4).map((item) => item.imageId),
      likeCount: this.likes.count(collection.id),
      likedByViewer: this.likes.has(collection.id, viewerId),
      role: membership?.role ?? null,
    };
  }
}
