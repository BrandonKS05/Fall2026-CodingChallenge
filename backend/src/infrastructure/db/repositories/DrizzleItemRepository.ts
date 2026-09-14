import { asc, desc, eq, sql } from 'drizzle-orm';
import type { CollectionItem, ItemDetail } from '../../../domain/entities/CollectionItem.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type {
  ItemPatch,
  ItemRepository,
  NewItem,
} from '../../../ports/repositories/ItemRepository.js';
import type { Db } from '../client.js';
import { isUniqueViolation } from '../errors.js';
import { collectionItems, images, users } from '../schema/index.js';
import { toImage } from './DrizzleImageRepository.js';

type ItemRow = typeof collectionItems.$inferSelect;

const toItem = (row: ItemRow): CollectionItem => ({
  id: row.id,
  collectionId: row.collectionId,
  imageId: row.imageId,
  addedById: row.addedById,
  caption: row.caption,
  tags: row.tags,
  position: row.position,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Nested selection: Drizzle returns { item, image, addedBy } per row. */
const detailSelection = {
  item: collectionItems,
  image: images,
  addedBy: { id: users.id, displayName: users.displayName },
};

type DetailRow = { item: ItemRow; image: typeof images.$inferSelect; addedBy: { id: string; displayName: string } };

const toDetail = (row: DetailRow): ItemDetail => ({
  ...toItem(row.item),
  image: toImage(row.image),
  addedBy: row.addedBy,
});

const DUPLICATE_MESSAGE = 'This image is already on that board';

export class DrizzleItemRepository implements ItemRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<CollectionItem | null> {
    const row = await this.db.query.collectionItems.findFirst({ where: eq(collectionItems.id, id) });
    return row ? toItem(row) : null;
  }

  async findDetail(id: string): Promise<ItemDetail | null> {
    const [row] = await this.detailQuery().where(eq(collectionItems.id, id)).limit(1);
    return row ? toDetail(row) : null;
  }

  async listByCollection(collectionId: string): Promise<ItemDetail[]> {
    const rows = await this.detailQuery()
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(asc(collectionItems.position), desc(collectionItems.createdAt));
    return rows.map(toDetail);
  }

  async create(input: NewItem): Promise<CollectionItem> {
    try {
      const [row] = await this.db.insert(collectionItems).values(input).returning();
      if (!row) throw new Error('Insert returned no row');
      return toItem(row);
    } catch (error) {
      if (isUniqueViolation(error, 'collection_items_collection_image_idx')) {
        throw new ConflictError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(id: string, patch: ItemPatch): Promise<CollectionItem> {
    try {
      const [row] = await this.db
        .update(collectionItems)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(collectionItems.id, id))
        .returning();
      if (!row) throw new NotFoundError('Item', id);
      return toItem(row);
    } catch (error) {
      // Moving an item into a board that already holds the same image.
      if (isUniqueViolation(error, 'collection_items_collection_image_idx')) {
        throw new ConflictError(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(collectionItems).where(eq(collectionItems.id, id));
  }

  async nextPosition(collectionId: string): Promise<number> {
    const [row] = await this.db
      .select({ next: sql<number>`coalesce(max(${collectionItems.position}) + 1, 0)::int` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
    return row?.next ?? 0;
  }

  private detailQuery() {
    return this.db
      .select(detailSelection)
      .from(collectionItems)
      .innerJoin(images, eq(images.id, collectionItems.imageId))
      .innerJoin(users, eq(users.id, collectionItems.addedById));
  }
}
