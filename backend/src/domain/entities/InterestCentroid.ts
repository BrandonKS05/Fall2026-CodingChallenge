import type { Embedding } from './Embedding.js';

/**
 * Taste is not one point. Someone who likes brutalist buildings and tide pools
 * has two interests, and averaging them lands on neither, so a profile is a
 * handful of centroids rather than a single vector.
 */

/**
 * Where a centroid came from. Seeds are guesses made from the categories
 * somebody ticked at sign-up; they are the first to be evicted, because a
 * cluster earned by actual behaviour is worth more than one that was declared.
 */
export const CENTROID_ORIGINS = ['category-seed', 'interaction'] as const;
export type CentroidOrigin = (typeof CENTROID_ORIGINS)[number];

export interface InterestCentroid {
  id: string;
  userId: string;
  centroid: Embedding;
  /** Accumulated interaction weight: how much evidence stands behind this cluster. */
  weight: number;
  interactionCount: number;
  origin: CentroidOrigin;
  /** Last time something was blended in. Eviction reads this as staleness. */
  lastReinforcedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
