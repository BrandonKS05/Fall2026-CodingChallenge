/**
 * Collections (boards) contract: create, update, and the read shape returned
 * by list, detail, explore, and shared-link endpoints.
 */
import { z } from 'zod';
import { atLeastOneField, idSchema, timestampSchema, userSummarySchema } from './common.js';

/**
 * private  - members only
 * unlisted - anyone with the share link
 * public   - anyone with the link, and listed on Explore
 */
export const collectionVisibilitySchema = z.enum(['private', 'unlisted', 'followers', 'public']);
export type CollectionVisibility = z.infer<typeof collectionVisibilitySchema>;

/** owner manages everything; editor changes items; viewer reads. */
export const collectionRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type CollectionRole = z.infer<typeof collectionRoleSchema>;

const collectionFieldsSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  visibility: collectionVisibilitySchema,
});

export const createCollectionRequestSchema = collectionFieldsSchema.extend({
  description: collectionFieldsSchema.shape.description.default(''),
  visibility: collectionVisibilitySchema.default('private'),
});
export type CreateCollectionRequest = z.infer<typeof createCollectionRequestSchema>;

/** PATCH body: any subset of the editable fields, but not an empty object. */
export const updateCollectionRequestSchema = collectionFieldsSchema
  .partial()
  .refine(atLeastOneField, { error: 'At least one field must be provided' });
export type UpdateCollectionRequest = z.infer<typeof updateCollectionRequestSchema>;

export const collectionSchema = z.object({
  id: idSchema,
  owner: userSummarySchema,
  title: z.string(),
  description: z.string(),
  visibility: collectionVisibilitySchema,
  /** Present once a share link has been created; null otherwise. */
  shareSlug: z.string().nullable(),
  /** Up to four recent image ids for the cover mosaic. Fetched via /api/images/:id. */
  previewImageIds: z.array(idSchema).max(4),
  itemCount: z.number().int().nonnegative(),
  /** The requesting user's role, or null when viewing as a non-member. */
  role: collectionRoleSchema.nullable(),
  /** How many people like the board, and whether the requesting user does. */
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Collection = z.infer<typeof collectionSchema>;

export const collectionListResponseSchema = z.object({
  collections: z.array(collectionSchema),
});
export type CollectionListResponse = z.infer<typeof collectionListResponseSchema>;
