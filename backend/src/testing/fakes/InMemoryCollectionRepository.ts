import { randomUUID } from 'node:crypto';
import type { Collection, CollectionSummary } from '../../domain/entities/Collection.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type {
  CollectionPatch,
  CollectionRepository,
  ListPublicOptions,
  NewCollection,
} from '../../modules/collections/ports/CollectionRepository.js';
import type { InMemoryItemRepository } from './InMemoryItemRepository.js';
import type { InMemoryMembershipRepository } from './InMemoryMembershipRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

/** Port-conformant fake. Counts and previews come from the items fake, like the SQL summary does. */
export class InMemoryCollectionRepository implements CollectionRepository {
  readonly rows = new Map<string, Collection>();

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly memberships: InMemoryMembershipRepository,
    private readonly items: InMemoryItemRepository,
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
    const publicBoards = this.newestFirst().filter((row) => row.visibility === 'public');
    return Promise.all(
      publicBoards
        .slice(offset, offset + limit)
        .map((collection) => this.toSummary(collection, viewerId ?? null)),
    );
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
      ownerDisplayName: owner?.displayName ?? '',
      itemCount: items.length,
      previewImageIds: newestFirst.slice(0, 4).map((item) => item.imageId),
      role: membership?.role ?? null,
    };
  }
}
