import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../infrastructure/db/client.js';
import { collectionLikes } from '../../../infrastructure/db/schema/index.js';
import type { LikeRepository } from '../ports/LikeRepository.js';

/** Repository adapter for board likes; the composite key makes liking idempotent. */
export class DrizzleLikeRepository implements LikeRepository {
  constructor(private readonly db: Db) {}

  async like(collectionId: string, userId: string): Promise<boolean> {
    const inserted = await this.db
      .insert(collectionLikes)
      .values({ collectionId, userId })
      .onConflictDoNothing()
      .returning({ userId: collectionLikes.userId });
    return inserted.length > 0;
  }

  async unlike(collectionId: string, userId: string): Promise<boolean> {
    const removed = await this.db
      .delete(collectionLikes)
      .where(
        and(eq(collectionLikes.collectionId, collectionId), eq(collectionLikes.userId, userId)),
      )
      .returning({ userId: collectionLikes.userId });
    return removed.length > 0;
  }
}
