import { and, asc, desc, eq, lte, sql, type SQL, inArray } from 'drizzle-orm';
import type {
  Collection,
  CollectionVisibility,
  CollectionSummary,
  PublicImage,
} from '../../../domain/entities/Collection.js';
import type { CollectionRole } from '../../../domain/entities/Membership.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type {
  CollectionPatch,
  CollectionRepository,
  ListPublicImagesOptions,
  ListPublicOptions,
  NewCollection,
} from '../ports/CollectionRepository.js';
import { toImage } from '../../images/adapters/DrizzleImageRepository.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { isUniqueViolation } from '../../../infrastructure/db/errors.js';
import {
  collectionItems,
  collectionLikes,
  collectionMembers,
  collections,
  images,
  users,
} from '../../../infrastructure/db/schema/index.js';

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

/** How many people like the board. */
const likeCount = sql<number>`(
  select count(*)::int from ${collectionLikes}
  where ${collectionLikes.collectionId} = ${collections.id}
)`;

/** Whether the viewer likes the board; a visitor never does. */
function likedByViewer(viewerId: string | null): SQL<boolean> {
  if (viewerId === null) return sql<boolean>`false`;
  return sql<boolean>`exists (
    select 1 from ${collectionLikes}
    where ${collectionLikes.collectionId} = ${collections.id}
      and ${collectionLikes.userId} = ${viewerId}
  )`;
}

/** Columns shared by every summary query; `role` comes from the membership join. */
const summaryColumns = (viewerId: string | null) => ({
  id: collections.id,
  ownerId: collections.ownerId,
  title: collections.title,
  description: collections.description,
  visibility: collections.visibility,
  shareSlug: collections.shareSlug,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
  ownerHandle: users.handle,
  ownerDisplayName: users.displayName,
  itemCount,
  previewImageIds,
  likeCount,
  likedByViewer: likedByViewer(viewerId),
  role: collectionMembers.role,
});

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
  ownerHandle: row.ownerHandle,
  ownerDisplayName: row.ownerDisplayName,
  itemCount: row.itemCount,
  previewImageIds: row.previewImageIds,
  likeCount: row.likeCount,
  likedByViewer: row.likedByViewer,
  role: row.role,
});

/**
 * Someone who has turned discovery off keeps their public boards reachable by
 * link, but out of Explore. Settings written before the switch existed have no
 * such key, and `->>` yields null for those, which reads as still discoverable.
 */
const ownerIsDiscoverable = sql`coalesce((${users.preferences} ->> 'discoverable')::boolean, true)`;

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
      .select(summaryColumns(viewerId))
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      .leftJoin(collectionMembers, viewerMembership(viewerId))
      .where(eq(collections.id, id))
      .limit(1);
    return row ? toSummary(row) : null;
  }

  async listForUser(userId: string): Promise<CollectionSummary[]> {
    const rows = await this.db
      .select(summaryColumns(userId))
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      // Inner join: only boards where the user has a membership row (owners included).
      .innerJoin(collectionMembers, viewerMembership(userId))
      .orderBy(desc(collections.updatedAt));
    return rows.map(toSummary);
  }

  async listPublic({ limit, offset, viewerId }: ListPublicOptions): Promise<CollectionSummary[]> {
    const rows = await this.db
      .select(summaryColumns(viewerId ?? null))
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      .leftJoin(collectionMembers, viewerMembership(viewerId ?? null))
      .where(and(eq(collections.visibility, 'public'), ownerIsDiscoverable))
      .orderBy(desc(collections.updatedAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toSummary);
  }

  async listByOwner(
    ownerId: string,
    { viewerId, visibilities }: { viewerId: string | null; visibilities: CollectionVisibility[] },
  ): Promise<CollectionSummary[]> {
    if (visibilities.length === 0) return [];
    const rows = await this.db
      .select(summaryColumns(viewerId))
      .from(collections)
      .innerJoin(users, eq(users.id, collections.ownerId))
      .leftJoin(collectionMembers, viewerMembership(viewerId))
      .where(and(eq(collections.ownerId, ownerId), inArray(collections.visibility, visibilities)))
      .orderBy(desc(collections.updatedAt));
    return rows.map(toSummary);
  }

  /**
   * Two passes of window ranks do the work before LIMIT. First every placement
   * of an image is ranked so an image on several public boards is kept once,
   * credited to the most recently updated board. Then the survivors are ranked
   * within their board, which interleaves the boards: every board's newest
   * surviving image comes before any board's second. Only the top `limit` per
   * board reach the final sort, so a huge board cannot inflate the query.
   */
  async listPublicImages({ limit }: ListPublicImagesOptions): Promise<PublicImage[]> {
    const placements = this.db.$with('placements').as(
      this.db
        .select({
          itemId: collectionItems.id,
          imageId: collectionItems.imageId,
          collectionId: collectionItems.collectionId,
          addedAt: collectionItems.createdAt,
          boardUpdatedAt: collections.updatedAt,
          rankForImage:
            sql<number>`row_number() over (partition by ${collectionItems.imageId} order by ${collections.updatedAt} desc, ${collectionItems.createdAt} desc, ${collectionItems.id})`.as(
              'rank_for_image',
            ),
        })
        .from(collectionItems)
        .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
        .innerJoin(users, eq(users.id, collections.ownerId))
        .where(and(eq(collections.visibility, 'public'), ownerIsDiscoverable)),
    );
    const ranked = this.db.$with('ranked').as(
      this.db
        .select({
          itemId: placements.itemId,
          imageId: placements.imageId,
          collectionId: placements.collectionId,
          addedAt: placements.addedAt,
          boardUpdatedAt: placements.boardUpdatedAt,
          rankInBoard:
            sql<number>`row_number() over (partition by ${placements.collectionId} order by ${placements.addedAt} desc, ${placements.itemId})`.as(
              'rank_in_board',
            ),
        })
        .from(placements)
        .where(eq(placements.rankForImage, 1)),
    );
    const rows = await this.db
      .with(placements, ranked)
      .select({ image: images, collectionId: collections.id, collectionTitle: collections.title })
      .from(ranked)
      .innerJoin(images, eq(images.id, ranked.imageId))
      .innerJoin(collections, eq(collections.id, ranked.collectionId))
      .where(lte(ranked.rankInBoard, limit))
      .orderBy(
        asc(ranked.rankInBoard),
        desc(ranked.boardUpdatedAt),
        desc(ranked.addedAt),
        asc(ranked.itemId),
      )
      .limit(limit);
    return rows.map((row) => ({
      image: toImage(row.image),
      collectionId: row.collectionId,
      collectionTitle: row.collectionTitle,
    }));
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
      .set({ ...patch, updatedAt: sql`now()` })
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
    await this.db
      .update(collections)
      .set({ updatedAt: sql`now()` })
      .where(eq(collections.id, id));
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
