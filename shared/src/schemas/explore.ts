/**
 * Explore feed for the landing stage: distinct images across public boards.
 * Lives apart from collection.ts because it needs the item image shape and
 * item.ts already imports collection.ts.
 */
import { z } from 'zod';
import { idSchema } from './common.js';
import { imageSchema } from './item.js';

/** GET /api/explore/images query. Values arrive as strings, so `limit` is coerced. */
export const exploreImagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type ExploreImagesQuery = z.infer<typeof exploreImagesQuerySchema>;

/** One image on a public board, with just enough of the board to link to it. */
export const exploreImageSchema = z.object({
  image: imageSchema,
  collection: z.object({ id: idSchema, title: z.string() }),
});
export type ExploreImage = z.infer<typeof exploreImageSchema>;

/** Every image once, boards interleaved so no board dominates, newest first. */
export const exploreImagesResponseSchema = z.object({ images: z.array(exploreImageSchema) });
export type ExploreImagesResponse = z.infer<typeof exploreImagesResponseSchema>;

/**
 * The landing stage's own feed. It carries images and nothing else: the hero is
 * a fixed curation, never a window onto what people have posted.
 */
export const landingImagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type LandingImagesQuery = z.infer<typeof landingImagesQuerySchema>;

export const landingImagesResponseSchema = z.object({ images: z.array(imageSchema) });
export type LandingImagesResponse = z.infer<typeof landingImagesResponseSchema>;
