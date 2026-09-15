/** Who likes which board. Counts ride along on collection summaries. */
export interface LikeRepository {
  /** Resolves true when this is a new like, false when it already existed. */
  like(collectionId: string, userId: string): Promise<boolean>;
  /** Resolves true when a like was removed, false when there was none. */
  unlike(collectionId: string, userId: string): Promise<boolean>;
}
