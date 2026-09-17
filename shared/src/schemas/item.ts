/**
 * Items contract: an image saved into a collection, plus the stored image itself.
 * Images are stored once and referenced by many items.
 */
import { z } from 'zod';
import { atLeastOneField, idSchema, timestampSchema, userSummarySchema } from './common.js';
import { imageCreditSchema, imageProviderSchema } from './search.js';
import { collectionSchema } from './collection.js';

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

/** An image the backend has downloaded and now serves itself. */
/**
 * A name for a picture that arrived without one. The providers index photos by
 * tag rather than by title, so the first few tags become the title: capitalised,
 * and short enough to read at a glance. Empty when there is nothing to go on.
 */
export function imageTitle(tags: readonly string[]): string {
  const words = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 3);
  if (words.length === 0) return '';
  const phrase = words.join(', ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * POST /collections/:id/items/upload — the picture is the body, so its caption
 * and tags ride in the query string.
 */
export const uploadItemQuerySchema = z.object({
  caption: z.string().trim().max(500).default(''),
  /** Comma-separated, because a query string has no arrays worth the trouble. */
  tags: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 10),
    ),
});
export type UploadItemQuery = z.infer<typeof uploadItemQuerySchema>;

export const imageSchema = z.object({
  id: idSchema,
  /** Path served by our API, e.g. /api/images/<id>. Never a provider URL. */
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Compact blurred placeholder, computed at save time. */
  blurhash: z.string().nullable(),
  /** Dominant colors, computed at save time. Empty until extracted. */
  palette: z.array(hexColorSchema).max(5),
  tags: z.array(z.string()),
  credit: imageCreditSchema,
  /** The page the picture came from. Null for one somebody uploaded themselves. */
  sourceUrl: z.url().nullable(),
  provider: imageProviderSchema,
  providerImageId: z.string(),
});
export type Image = z.infer<typeof imageSchema>;

export const captionSchema = z.string().trim().max(500);
export const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(20);

/**
 * Save request. Only the provider id is sent; the backend looks the image up
 * and downloads it, so it never fetches a client-supplied URL.
 */
export const createItemRequestSchema = z.object({
  provider: imageProviderSchema,
  providerImageId: z.string().min(1).max(64),
  caption: captionSchema.default(''),
  tags: tagsSchema.default([]),
});
export type CreateItemRequest = z.infer<typeof createItemRequestSchema>;

/** PATCH body. Setting collectionId moves the item to another board. */
export const updateItemRequestSchema = z
  .object({
    caption: captionSchema,
    tags: tagsSchema,
    position: z.number().int().nonnegative(),
    collectionId: idSchema,
  })
  .partial()
  .refine(atLeastOneField, { error: 'At least one field must be provided' });
export type UpdateItemRequest = z.infer<typeof updateItemRequestSchema>;

export const itemSchema = z.object({
  id: idSchema,
  collectionId: idSchema,
  image: imageSchema,
  caption: z.string(),
  tags: z.array(z.string()),
  position: z.number().int().nonnegative(),
  addedBy: userSummarySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Item = z.infer<typeof itemSchema>;

/** An item in the person's own Pins view: the item plus the board it lives on. */
export const savedItemSchema = itemSchema.extend({
  collection: z.object({ id: idSchema, title: z.string() }),
});
export type SavedItem = z.infer<typeof savedItemSchema>;

/** GET /api/items query. Values arrive as strings, so `limit` is coerced. */
export const savedItemsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type SavedItemsQuery = z.infer<typeof savedItemsQuerySchema>;

export const savedItemsResponseSchema = z.object({ items: z.array(savedItemSchema) });
export type SavedItemsResponse = z.infer<typeof savedItemsResponseSchema>;

/** Returned by collection detail and by the shared-link endpoint. */
export const collectionDetailResponseSchema = z.object({
  collection: collectionSchema,
  items: z.array(itemSchema),
});
export type CollectionDetailResponse = z.infer<typeof collectionDetailResponseSchema>;
