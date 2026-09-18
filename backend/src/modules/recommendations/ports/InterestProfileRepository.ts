import type { CentroidOrigin } from '../../../domain/entities/InterestCentroid.js';
import type { InteractionType } from '../../../domain/entities/Interaction.js';

export interface StoredCentroid {
  id: string;
  centroid: number[];
  weight: number;
  origin: CentroidOrigin;
  lastReinforcedAt: Date;
}

export interface NewCentroid {
  centroid: number[];
  weight: number;
  origin: CentroidOrigin;
}

export interface CentroidPatch {
  centroid: number[];
  weight: number;
  origin: CentroidOrigin;
}

export interface InteractionEntry {
  userId: string;
  itemId: string;
  type: InteractionType;
  weight: number;
  dwellMs: number | null;
}

export interface InterestProfileRepository {
  findCentroids(userId: string): Promise<StoredCentroid[]>;
  insertCentroid(userId: string, centroid: NewCentroid): Promise<void>;
  /** Used by seeding: a profile is replaced wholesale or not at all. */
  replaceSeedCentroids(userId: string, centroids: NewCentroid[]): Promise<void>;
  updateCentroid(id: string, patch: CentroidPatch): Promise<void>;
  deleteCentroid(id: string): Promise<void>;
  /**
   * Writes the act down. False when this exact deliberate act was already on
   * record, so liking something twice does not count twice.
   */
  recordInteraction(entry: InteractionEntry): Promise<boolean>;
  findItemVector(itemId: string): Promise<number[] | null>;
  /**
   * Everything done to these pictures, oldest first. Acts are recorded whether
   * or not the picture had a vector at the time, so this is how the profile
   * catches up on the ones that were saved before they were embedded.
   */
  findInteractionsForItems(itemIds: string[]): Promise<InteractionEntry[]>;
}
