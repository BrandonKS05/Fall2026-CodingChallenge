import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../../../infrastructure/db/client.js';
import { collectionItems, images } from '../../../infrastructure/db/schema/index.js';
import type {
  EmbeddableRow,
  EmbeddingRepository,
  SavedEmbedding,
} from '../ports/EmbeddingRepository.js';

export class DrizzleEmbeddingRepository implements EmbeddingRepository {
  constructor(private readonly db: Db) {}

  /**
   * Oldest first, through the partial index on the null embeddings, so the
   * scan never touches the pictures that are already done.
   */
  async claimPending(limit: number, maxAttempts: number): Promise<EmbeddableRow[]> {
    const rows = await this.select()
      .where(
        and(isNull(collectionItems.embedding), lt(collectionItems.embeddingAttempts, maxAttempts)),
      )
      .orderBy(asc(collectionItems.createdAt))
      .limit(limit);
    return rows.map(toRow);
  }

  async findByIds(ids: string[]): Promise<EmbeddableRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.select().where(inArray(collectionItems.id, ids));
    return rows.map(toRow);
  }

  /**
   * One statement per picture inside one transaction. At a batch of a hundred
   * that is cheaper than building a CASE expression with a hundred vectors in
   * it, and it is obvious what it does.
   */
  async save(entries: SavedEmbedding[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const entry of entries) {
        await tx
          .update(collectionItems)
          .set({
            embedding: entry.embedding,
            embeddingInputHash: entry.inputHash,
            embeddedAt: sql`now()`,
            embeddingAttempts: 0,
          })
          .where(eq(collectionItems.id, entry.id));
      }
    });
  }

  async recordFailure(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(collectionItems)
      .set({ embeddingAttempts: sql`${collectionItems.embeddingAttempts} + 1` })
      .where(inArray(collectionItems.id, ids));
  }

  async skip(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(collectionItems)
      .set({ embeddingAttempts: sql`2147483647::smallint` })
      .where(inArray(collectionItems.id, ids));
  }

  async clearEmbedding(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(collectionItems)
      .set({ embedding: null, embeddedAt: null, embeddingAttempts: 0 })
      .where(inArray(collectionItems.id, ids));
  }

  async countPending(maxAttempts: number): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(collectionItems)
      .where(
        and(isNull(collectionItems.embedding), lt(collectionItems.embeddingAttempts, maxAttempts)),
      );
    return row?.count ?? 0;
  }

  private select() {
    return this.db
      .select({
        id: collectionItems.id,
        caption: collectionItems.caption,
        tags: collectionItems.tags,
        imageTags: images.tags,
        inputHash: collectionItems.embeddingInputHash,
      })
      .from(collectionItems)
      .innerJoin(images, eq(images.id, collectionItems.imageId));
  }
}

function toRow(row: {
  id: string;
  caption: string;
  tags: string[];
  imageTags: string[];
  inputHash: string | null;
}): EmbeddableRow {
  return {
    id: row.id,
    caption: row.caption,
    tags: row.tags,
    image: { tags: row.imageTags },
    inputHash: row.inputHash,
  };
}
