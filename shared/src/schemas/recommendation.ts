import { z } from 'zod';
import { idSchema } from './common.js';
import { savedItemSchema } from './item.js';
import { searchCategorySchema } from './search.js';

/** What somebody can do with a picture, and how much each is worth is the server's business. */
export const interactionTypeSchema = z.enum(['view', 'like', 'save', 'share', 'hide']);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

/**
 * A cursor is opaque on purpose: it names a frozen feed and a position in it,
 * and the client should not be able to take it apart or make one up.
 */
export const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;

export const recommendationsResponseSchema = z.object({
  items: z.array(savedItemSchema),
  /** Null once the feed has run out rather than looping. */
  cursor: z.string().nullable(),
  /**
   * False when there is no profile behind this feed yet and it is simply what
   * other people like. The client cannot infer it — a cold feed is full of
   * pictures too — so the server says.
   */
  personalised: z.boolean(),
});
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;

export const recordInteractionRequestSchema = z.object({
  itemId: idSchema,
  type: interactionTypeSchema,
  /** How long it was on screen. Only a view is judged by it. */
  dwellMs: z.number().int().min(0).max(600_000).optional(),
});
export type RecordInteractionRequest = z.infer<typeof recordInteractionRequestSchema>;

/** The categories ticked at sign-up, which seed the first feed. */
export const chooseInterestsRequestSchema = z.object({
  categories: z.array(searchCategorySchema).min(1).max(20),
});
export type ChooseInterestsRequest = z.infer<typeof chooseInterestsRequestSchema>;
