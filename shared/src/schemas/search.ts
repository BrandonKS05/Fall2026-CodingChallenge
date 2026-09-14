/**
 * Image discovery contract. Results are provider-agnostic: the backend adapts
 * each provider's response into this shape, so adding Unsplash later changes
 * nothing on the frontend.
 */
import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/** Extension point: add a provider here and implement its ImageProvider strategy on the backend. */
export const imageProviderSchema = z.enum(['pixabay']);
export type ImageProvider = z.infer<typeof imageProviderSchema>;

export const imageOrientationSchema = z.enum(['all', 'horizontal', 'vertical']);

export const searchColorSchema = z.enum([
  'grayscale',
  'transparent',
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'blue',
  'lilac',
  'pink',
  'white',
  'gray',
  'black',
  'brown',
]);

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100),
  orientation: imageOrientationSchema.default('all'),
  color: searchColorSchema.optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Attribution shown wherever an image appears. Required by Pixabay's terms. */
export const imageCreditSchema = z.object({
  name: z.string(),
  profileUrl: z.url().nullable(),
});
export type ImageCredit = z.infer<typeof imageCreditSchema>;

/**
 * One search hit. The URLs here are the provider's and are temporary
 * (Pixabay's expire after 24 hours), so they are displayed but never stored.
 * Saving an image sends providerImageId to the backend, which downloads it.
 */
export const searchResultSchema = z.object({
  provider: imageProviderSchema,
  providerImageId: z.string(),
  /** Small thumbnail (about 150px) used as the instant placeholder in the grid. */
  previewUrl: z.url(),
  previewWidth: z.number().int().positive(),
  previewHeight: z.number().int().positive(),
  /** Medium image (about 640px) shown in the grid once loaded. */
  displayUrl: z.url(),
  /** Dimensions of the full-size original, used for aspect-ratio layout. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tags: z.array(z.string()),
  credit: imageCreditSchema,
  /** Provider page for this image, linked for attribution. */
  sourceUrl: z.url(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
  /** Total hits reachable through pagination for this query. */
  total: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
