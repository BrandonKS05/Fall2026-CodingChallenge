import type { SavedItem } from '../../../domain/entities/CollectionItem.js';
import type { Candidate } from '../../../domain/entities/Recommendation.js';

/** An item on the feed: the picture, plus the board it sits on so it can be opened. */
export type FeedItem = SavedItem;

export interface FeedRepository {
  /**
   * The nearest public pictures to one interest, excluding what this reader
   * has already been shown and anything they saved themselves.
   */
  findNearest(userId: string, vector: number[], limit: number): Promise<Candidate[]>;
  /**
   * Recent public pictures other people have acted on. Cold start reads this
   * instead of a profile, and every feed keeps a share of it for exploring.
   */
  findPopular(userId: string, limit: number): Promise<Candidate[]>;
  /** Freezes an order and returns the id that is the cursor for it. */
  createSlate(userId: string, itemIds: string[], expiresAt: Date): Promise<string>;
  /** The frozen order, or null when the cursor is unknown, expired, or someone else's. */
  findSlate(id: string, userId: string): Promise<string[] | null>;
  /** Hydrates a page, in the order asked for. */
  findItems(itemIds: string[]): Promise<FeedItem[]>;
  /** Remembers what has been put in front of somebody, so it is not offered again. */
  recordImpressions(userId: string, itemIds: string[]): Promise<void>;
  /** Drops slates and impressions past the retention window. */
  forget(before: Date): Promise<void>;
}
