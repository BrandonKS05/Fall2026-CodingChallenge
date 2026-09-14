import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import type {
  Collection,
  CollectionSummary,
} from '../../../domain/entities/Collection.js';
import type { CollectionRole } from '../../../domain/entities/Membership.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type {
  CollectionPatch,
  CollectionRepository,
  ListPublicOptions,
  NewCollection,
} from '../../../ports/repositories/CollectionRepository.js';
import type { Db } from '../client.js';
import { isUniqueViolation } from '../errors.js';
import { collectionItems, collectionMembers, collections, users } from '../schema/index.js';

type CollectionRow = typeof collections.$inferSelect;

const toCollection = (row: CollectionRow): Collection => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  shareSlug: row.shareSlug,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Number of items in the board. */
const itemCount = sql<number>`(
  select count(*)::int from ${collectionItems}
  where ${collectionItems.collectionId} = ${collections.id}
)`;

/** Up to four most recent image ids, for the cover mosaic. */
const previewImageIds = sql<string[]>`(
  select coalesce(array_agg(recent.image_id::text order by recent.created_at desc), '{}')
  from (
    select ${collectionItems.imageId} as image_id, ${collectionItems.createdAt} as created_at
    from ${collectionItems}
    where ${collectionItems.collectionId} = ${collections.id}
    order by ${collectionItems.createdAt} desc
    limit 4
  ) as recent
)`;

/** Columns shared by every summary query; `role` comes from the membership join. */
const summaryColumns = {
  id: collections.id,
  ownerId: collections.ownerId,
  title: collections.title,
  description: collections.description,
  visibility: collections.visibility,
  shareSlug: collections.shareSlug,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
  ownerDisplayName: users.displayName,
  itemCount,
  previewImageIds,
  role: collectionMembers.role,
};

type SummaryRow = Omit<CollectionSummary, 'role'> & { role: CollectionRole | null };

const toSummary = (row: SummaryRow): CollectionSummary => ({
  id: row.id,
  ownerId: row.ownerId,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  shareSlug: row.shareSlug,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ownerDisplayName: row.ownerDisplayName,
  itemCount: row.itemCount,
  previewImageIds: row.previewImageIds,
  role: row.role,
});

export class DrizzleCollectionRepository implements CollectionRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Collection | null> {
    const row = await this.db.query.collections.findFirst({ where: eq(collections.id, id) });
    return row ? toCollection(row) : null;
  }

  async findByShareSlug(slug: string): Promise<Collection | null> {
    const row = await this.db.query.collections.findFirst({
      where: eq(collections.shareSlug, slug),
    });
    return row ? toCollection(row) : null;
  }

  async findSummary(id: string, viewerId: string | null): Promise<CollectionSummary | null> {
    const [row] = await this.db
      .select(summaryColumns)
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      .leftJoin(collectionMembers, viewerMembership(viewerId))
      .where(eq(collections.id, id))
      .limit(1);
    return row ? toSummary(row) : null;
  }

  async listForUser(userId: string): Promise<CollectionSummary[]> {
    const rows = await this.db
      .select(summaryColumns)
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      // Inner join: only boards where the user has a membership row (owners included).
      .innerJoin(collectionMembers, viewerMembership(userId))
      .orderBy(desc(collections.updatedAt));
    return rows.map(toSummary);
  }

  async listPublic({ limit, offset, viewerId }: ListPublicOptions): Promise<CollectionSummary[]> {
    const rows = await this.db
      .select(summaryColumns)
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      .leftJoin(collectionMembers, viewerMembership(viewerId ?? null))
      .where(eq(collections.visibility, 'public'))
      .orderBy(desc(collections.updatedAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toSummary);
  }

  /** The board and its owner membership are written in one transaction so neither can exist alone. */
  create(input: NewCollection): Promise<Collection> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(collections).values(input).returning();
      if (!row) throw new Error('Insert returned no row');
      await tx
        .insert(collectionMembers)
        .values({ collectionId: row.id, userId: input.ownerId, role: 'owner' });
      return toCollection(row);
    });
  }

  async update(id: string, patch: CollectionPatch): Promise<Collection> {
    const [row] = await this.db
      .update(collections)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    if (!row) throw new NotFoundError('Collection', id);
    return toCollection(row);
  }

  async setShareSlug(id: string, slug: string | null): Promise<Collection> {
    try {
      const [row] = await this.db
        .update(collections)
        .set({ shareSlug: slug })
        .where(eq(collections.id, id))
        .returning();
      if (!row) throw new NotFoundError('Collection', id);
      return toCollection(row);
    } catch (error) {
      if (isUniqueViolation(error, 'collections_share_slug_unique')) {
        throw new ConflictError('Share link is already in use');
      }
      throw error;
    }
  }

  async touch(id: string): Promise<void> {
    await this.db.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(collections).where(eq(collections.id, id));
  }
}

/** Join condition matching the viewer's own membership row, or nothing for anonymous viewers. */
function viewerMembership(viewerId: string | null): SQL {
  if (viewerId === null) return sql`false`;
  return and(
    eq(collectionMembers.collectionId, collections.id),
    eq(collectionMembers.userId, viewerId),
  ) as SQL;
}
