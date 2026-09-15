/**
 * Public profiles and the follow graph. A profile is what anyone may see of
 * someone else: who they are, what they have made public, and whether the
 * person looking already follows them.
 */
import { z } from 'zod';
import { handleSchema } from './auth.js';
import { collectionSchema } from './collection.js';
import { idSchema, timestampSchema } from './common.js';

/** One row in a followers or following list. */
export const profileSummarySchema = z.object({
  id: idSchema,
  handle: z.string(),
  displayName: z.string(),
  bio: z.string(),
  /** Whether the person asking follows this one. Always false for a visitor. */
  followedByViewer: z.boolean(),
});
export type ProfileSummary = z.infer<typeof profileSummarySchema>;

export const publicProfileSchema = profileSummarySchema.extend({
  joinedAt: timestampSchema,
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  /** Public boards only: a profile shows what its owner chose to show. */
  boardCount: z.number().int().nonnegative(),
  /** True when you are looking at your own profile, so the client hides Follow. */
  isViewer: z.boolean(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

/** GET /api/users/:handle — the profile and the boards it lists, in one answer. */
export const profileResponseSchema = z.object({
  profile: publicProfileSchema,
  boards: z.array(collectionSchema),
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const followListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type FollowListQuery = z.infer<typeof followListQuerySchema>;

export const followListResponseSchema = z.object({ profiles: z.array(profileSummarySchema) });
export type FollowListResponse = z.infer<typeof followListResponseSchema>;

/** Path params for /api/users/:handle and everything under it. */
export const handleParamsSchema = z.object({ handle: handleSchema });
export type HandleParams = z.infer<typeof handleParamsSchema>;
