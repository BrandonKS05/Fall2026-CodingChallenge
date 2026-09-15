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
  sourceUrl: z.url(),
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
