import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../infrastructure/db/client.js';
import {
  collectionItems,
  interactions,
  userInterestCentroids,
} from '../../../infrastructure/db/schema/index.js';
import type {
  CentroidPatch,
  InteractionEntry,
  InterestProfileRepository,
  NewCentroid,
  StoredCentroid,
} from '../ports/InterestProfileRepository.js';

export class DrizzleInterestProfileRepository implements InterestProfileRepository {
  constructor(private readonly db: Db) {}

  async findCentroids(userId: string): Promise<StoredCentroid[]> {
    return this.db
      .select({
        id: userInterestCentroids.id,
        centroid: userInterestCentroids.centroid,
        weight: userInterestCentroids.weight,
        origin: userInterestCentroids.origin,
        lastReinforcedAt: userInterestCentroids.lastReinforcedAt,
      })
      .from(userInterestCentroids)
      .where(eq(userInterestCentroids.userId, userId));
  }

  async insertCentroid(userId: string, centroid: NewCentroid): Promise<void> {
    await this.db.insert(userInterestCentroids).values({
      userId,
      centroid: centroid.centroid,
      weight: centroid.weight,
      origin: centroid.origin,
      interactionCount: centroid.origin === 'category-seed' ? 0 : 1,
    });
  }

  /**
   * Seeds are replaced wholesale; interests earned by behaviour are never
   * touched, so re-running the sign-up picks cannot undo what somebody did.
   */
  async replaceSeedCentroids(userId: string, centroids: NewCentroid[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(userInterestCentroids)
        .where(
          and(
            eq(userInterestCentroids.userId, userId),
            eq(userInterestCentroids.origin, 'category-seed'),
          ),
        );
      if (centroids.length === 0) return;
      await tx.insert(userInterestCentroids).values(
        centroids.map((centroid) => ({
          userId,
          centroid: centroid.centroid,
          weight: centroid.weight,
          origin: centroid.origin,
          interactionCount: 0,
        })),
      );
    });
  }

  async updateCentroid(id: string, patch: CentroidPatch): Promise<void> {
    await this.db
      .update(userInterestCentroids)
      .set({
        centroid: patch.centroid,
        weight: patch.weight,
        origin: patch.origin,
        interactionCount: sql`${userInterestCentroids.interactionCount} + 1`,
        // The database's clock, so staleness stays true when app and database
        // servers disagree about the time.
        lastReinforcedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(userInterestCentroids.id, id));
  }

  async deleteCentroid(id: string): Promise<void> {
    await this.db.delete(userInterestCentroids).where(eq(userInterestCentroids.id, id));
  }

  /**
   * The partial unique index takes care of "twice is once" for deliberate acts
   * and lets views repeat, so an empty returning row means it was already done.
   */
  async recordInteraction(entry: InteractionEntry): Promise<boolean> {
    const written = await this.db
      .insert(interactions)
      .values({
        userId: entry.userId,
        itemId: entry.itemId,
        type: entry.type,
        weight: entry.weight,
        dwellMs: entry.dwellMs,
      })
      .onConflictDoNothing()
      .returning({ id: interactions.id });
    return written.length > 0;
  }

  async findInteractionsForItems(itemIds: string[]): Promise<InteractionEntry[]> {
    if (itemIds.length === 0) return [];
    const rows = await this.db
      .select({
        userId: interactions.userId,
        itemId: interactions.itemId,
        type: interactions.type,
        weight: interactions.weight,
        dwellMs: interactions.dwellMs,
      })
      .from(interactions)
      .where(inArray(interactions.itemId, itemIds))
      .orderBy(asc(interactions.createdAt));
    return rows;
  }

  async findItemVector(itemId: string): Promise<number[] | null> {
    const [row] = await this.db
      .select({ embedding: collectionItems.embedding })
      .from(collectionItems)
      .where(eq(collectionItems.id, itemId));
    return row?.embedding ?? null;
  }
}
