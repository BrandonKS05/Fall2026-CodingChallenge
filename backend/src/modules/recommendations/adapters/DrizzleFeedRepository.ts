/**
 * The feed's queries, written out rather than assembled, because these are the
 * ones worth reading and worth running EXPLAIN against.
 *
 * `findNearest` is the only one that touches the vector index. It over-fetches
 * and filters afterwards: pgvector applies a WHERE that the index cannot serve
 * *after* the index scan, so asking for exactly what is wanted returns less
 * than that once anything is excluded. At a few thousand rows over-fetching is
 * free. Past a million, turn on `hnsw.iterative_scan = relaxed_order` (0.8+)
 * instead, which re-enters the index until the limit is really met.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../../../infrastructure/db/client.js';
import type { Candidate } from '../../../domain/entities/Recommendation.js';
import type { FeedItem, FeedRepository } from '../ports/FeedRepository.js';

/** How much wider to cast the net than the caller asked for. */
const OVERFETCH = 3;

interface CandidateRow extends Record<string, unknown> {
  item_id: string;
  image_id: string;
  author_id: string;
  created_at: Date;
  similarity: number;
  engagement: number;
}

const toCandidate = (row: CandidateRow, centroidId: string | null): Candidate => ({
  itemId: row.item_id,
  imageId: row.image_id,
  authorId: row.author_id,
  createdAt: new Date(row.created_at),
  similarity: Number(row.similarity),
  engagement: Number(row.engagement),
  centroidId,
});

/**
 * How much attention a picture has had: how many people saved the same photo,
 * and how many liked the board this copy sits on. Counted for the shortlist
 * only, never for the whole table.
 */
const ENGAGEMENT = sql`
  (SELECT count(*) - 1 FROM collection_items s WHERE s.image_id = n.image_id)
  + (SELECT count(*) FROM collection_likes cl WHERE cl.collection_id = n.collection_id)
`;

export class DrizzleFeedRepository implements FeedRepository {
  constructor(private readonly db: Db) {}

  async findNearest(userId: string, vector: number[], limit: number): Promise<Candidate[]> {
    const probe = JSON.stringify(vector);
    const rows = await this.db.execute<CandidateRow>(sql`
      WITH nearest AS (
        SELECT ci.id AS item_id, ci.image_id, ci.added_by_id AS author_id,
               ci.collection_id, ci.created_at,
               -(ci.embedding <#> ${probe}::vector) AS similarity
          FROM collection_items ci
         WHERE ci.is_public
           AND ci.embedding IS NOT NULL
           AND ci.added_by_id <> ${userId}
           AND NOT EXISTS (
                 SELECT 1 FROM feed_impressions fi
                  WHERE fi.user_id = ${userId} AND fi.item_id = ci.id)
         ORDER BY ci.embedding <#> ${probe}::vector
         LIMIT ${limit * OVERFETCH}
      )
      SELECT n.item_id, n.image_id, n.author_id, n.created_at, n.similarity,
             ${ENGAGEMENT} AS engagement
        FROM nearest n
       LIMIT ${limit}
    `);
    return rows.rows.map((row) => toCandidate(row, null));
  }

  /**
   * What is worth showing somebody the app knows nothing about: public, recent,
   * and saved or liked by other people. No vector involved, which is what makes
   * it a safe floor when there is no profile and no embedding yet.
   */
  async findPopular(userId: string, limit: number): Promise<Candidate[]> {
    const rows = await this.db.execute<CandidateRow>(sql`
      WITH recent AS (
        SELECT ci.id AS item_id, ci.image_id, ci.added_by_id AS author_id,
               ci.collection_id, ci.created_at
          FROM collection_items ci
         WHERE ci.is_public
           AND ci.added_by_id <> ${userId}
           AND NOT EXISTS (
                 SELECT 1 FROM feed_impressions fi
                  WHERE fi.user_id = ${userId} AND fi.item_id = ci.id)
         ORDER BY ci.created_at DESC
         LIMIT ${limit * OVERFETCH}
      )
      SELECT n.item_id, n.image_id, n.author_id, n.created_at,
             0::float8 AS similarity, ${ENGAGEMENT} AS engagement
        FROM recent n
       ORDER BY engagement DESC, n.created_at DESC
       LIMIT ${limit}
    `);
    return rows.rows.map((row) => toCandidate(row, null));
  }

  async createSlate(userId: string, itemIds: string[], expiresAt: Date): Promise<string> {
    const rows = await this.db.execute<{ id: string }>(sql`
      INSERT INTO feed_slates (user_id, item_ids, expires_at)
      VALUES (${userId}, ${sql.raw(`'{${itemIds.join(',')}}'::uuid[]`)}, ${expiresAt.toISOString()})
      RETURNING id
    `);
    return rows.rows[0]!.id;
  }

  async findSlate(id: string, userId: string): Promise<string[] | null> {
    const rows = await this.db.execute<{ item_ids: string[] }>(sql`
      SELECT item_ids FROM feed_slates
       WHERE id = ${id}::uuid AND user_id = ${userId} AND expires_at > now()
    `);
    return rows.rows[0]?.item_ids ?? null;
  }

  /** In the order asked for: the slate decides the order, not the database. */
  async findItems(itemIds: string[]): Promise<FeedItem[]> {
    if (itemIds.length === 0) return [];
    const rows = await this.db.execute<Record<string, never>>(sql`
      SELECT ci.id, ci.collection_id, ci.caption, ci.tags, ci.position,
             ci.created_at, ci.updated_at,
             c.title AS collection_title,
             u.id AS author_id, u.handle AS author_handle, u.display_name AS author_name,
             i.id AS image_id, i.provider, i.provider_image_id, i.storage_key,
             i.width, i.height, i.blurhash, i.palette, i.tags AS image_tags,
             i.credit_name, i.credit_url, i.source_url, i.created_at AS image_created_at
        FROM collection_items ci
        JOIN collections c ON c.id = ci.collection_id
        JOIN users u ON u.id = ci.added_by_id
        JOIN images i ON i.id = ci.image_id
       WHERE ci.id = ANY(${sql.raw(`'{${itemIds.join(',')}}'::uuid[]`)})
    `);
    const byId = new Map(rows.rows.map((row) => [String(row['id']), toFeedItem(row)]));
    return itemIds.map((id) => byId.get(id)).filter((item) => item !== undefined);
  }

  async recordImpressions(userId: string, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;
    await this.db.execute(sql`
      INSERT INTO feed_impressions (user_id, item_id)
      SELECT ${userId}, unnest(${sql.raw(`'{${itemIds.join(',')}}'::uuid[]`)})
      ON CONFLICT (user_id, item_id) DO NOTHING
    `);
  }

  /** The retention sweep that keeps both tables from growing without bound. */
  async forget(before: Date): Promise<void> {
    await this.db.execute(
      sql`DELETE FROM feed_impressions WHERE served_at < ${before.toISOString()}`,
    );
    await this.db.execute(sql`DELETE FROM feed_slates WHERE expires_at < ${before.toISOString()}`);
  }
}

function toFeedItem(row: Record<string, unknown>): FeedItem {
  return {
    id: String(row['id']),
    collectionId: String(row['collection_id']),
    collectionTitle: String(row['collection_title']),
    imageId: String(row['image_id']),
    addedById: String(row['author_id']),
    caption: String(row['caption']),
    tags: (row['tags'] as string[]) ?? [],
    position: Number(row['position']),
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
    addedBy: {
      id: String(row['author_id']),
      handle: String(row['author_handle']),
      displayName: String(row['author_name']),
    },
    image: {
      id: String(row['image_id']),
      provider: row['provider'] as 'pixabay' | 'upload',
      providerImageId: String(row['provider_image_id']),
      storageKey: String(row['storage_key']),
      width: Number(row['width']),
      height: Number(row['height']),
      blurhash: (row['blurhash'] as string | null) ?? null,
      palette: (row['palette'] as string[]) ?? [],
      tags: (row['image_tags'] as string[]) ?? [],
      credit: {
        name: String(row['credit_name']),
        url: (row['credit_url'] as string | null) ?? null,
      },
      sourceUrl: (row['source_url'] as string | null) ?? null,
      createdAt: new Date(row['image_created_at'] as string),
    },
  };
}
