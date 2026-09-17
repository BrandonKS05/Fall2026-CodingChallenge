/**
 * What a person did with a picture someone saved.
 *
 * The domain says which things can happen; how much each one counts towards
 * their taste is a tuning decision and lives in the recommendations config.
 */
export const INTERACTION_TYPES = ['view', 'like', 'save', 'share', 'hide'] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface Interaction {
  id: string;
  userId: string;
  itemId: string;
  type: InteractionType;
  /**
   * The weight as it was applied. Stored rather than derived so that re-tuning
   * the config changes what happens next without rewriting what already did.
   */
  weight: number;
  /** How long it was on screen. Null for everything except a view. */
  dwellMs: number | null;
  createdAt: Date;
}
