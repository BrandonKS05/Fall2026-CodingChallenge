import { randomUUID } from 'node:crypto';
import type { CollectionItem, ItemDetail } from '../../domain/entities/CollectionItem.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type { ItemPatch, ItemRepository, NewItem } from '../../modules/items/ports/ItemRepository.js';
import type { InMemoryImageRepository } from './InMemoryImageRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

export class InMemoryItemRepository implements ItemRepository {
  readonly rows = new Map<string, CollectionItem>();

  constructor(
    private readonly images: InMemoryImageRepository,
    private readonly users: InMemoryUserRepository,
  ) {}

  async findById(id: string): Promise<CollectionItem | null> {
    return this.rows.get(id) ?? null;
  }

  async findDetail(id: string): Promise<ItemDetail | null> {
    const item = this.rows.get(id);
    return item ? this.toDetail(item) : null;
  }

  async listByCollection(collectionId: string): Promise<ItemDetail[]> {
    const items = [...this.rows.values()]
      .filter((item) => item.collectionId === collectionId)
      .sort((a, b) => a.position - b.position || b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.all(items.map((item) => this.toDetail(item)));
  }

  async create(input: NewItem): Promise<CollectionItem> {
    this.assertNotDuplicate(input.collectionId, input.imageId);
    const now = new Date();
    const item: CollectionItem = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.rows.set(item.id, item);
    return item;
  }

  async update(id: string, patch: ItemPatch): Promise<CollectionItem> {
    const existing = this.rows.get(id);
    if (!existing) throw new NotFoundError('Item', id);
    if (patch.collectionId && patch.collectionId !== existing.collectionId) {
      this.assertNotDuplicate(patch.collectionId, existing.imageId);
    }
    const updated = { ...existing, ...withoutUndefined(patch), updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async nextPosition(collectionId: string): Promise<number> {
    const positions = [...this.rows.values()]
      .filter((item) => item.collectionId === collectionId)
      .map((item) => item.position);
    return positions.length === 0 ? 0 : Math.max(...positions) + 1;
  }

  /** Test helper used when a collection is deleted. */
  removeAllFor(collectionId: string): void {
    for (const [id, item] of this.rows) {
      if (item.collectionId === collectionId) this.rows.delete(id);
    }
  }

  private assertNotDuplicate(collectionId: string, imageId: string): void {
    for (const item of this.rows.values()) {
      if (item.collectionId === collectionId && item.imageId === imageId) {
        throw new ConflictError('This image is already on that board');
      }
    }
  }

  private async toDetail(item: CollectionItem): Promise<ItemDetail> {
    const image = await this.images.findById(item.imageId);
    const user = await this.users.findById(item.addedById);
    if (!image) throw new Error(`fake: image ${item.imageId} missing`);
    return {
      ...item,
      image,
      addedBy: { id: item.addedById, displayName: user?.displayName ?? '' },
    };
  }
}

/** Like Drizzle's update(), an undefined value means "leave unchanged". */
function withoutUndefined<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}
