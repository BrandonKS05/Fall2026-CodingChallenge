/**
 * Everything a person can tune about their own account. It travels as one JSON
 * document on the user, so adding a setting never needs a migration: whatever
 * is stored is read through `parsePreferences`, and anything missing or
 * unrecognised falls back to the defaults below.
 */
import { z } from 'zod';
import { collectionVisibilitySchema } from './collection.js';

/** One switch per kind of notification the inbox can show. */
export const notificationPreferencesSchema = z.object({
  itemAdded: z.boolean(),
  itemUpdated: z.boolean(),
  itemRemoved: z.boolean(),
  collectionUpdated: z.boolean(),
  memberAdded: z.boolean(),
  collectionLiked: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

/** Lowercased on the way in, so "Kitchen" and "kitchen" mute the same thing. */
export const mutedTagSchema = z.string().trim().toLowerCase().min(1).max(30);

const mutedTagsSchema = z
  .array(mutedTagSchema)
  .max(20)
  .transform((tags) => [...new Set(tags)]);

/** Who may see something: the same three steps everywhere they are offered. */
export const audienceSchema = z.enum(['everyone', 'followers', 'private']);
export type Audience = z.infer<typeof audienceSchema>;

export const userPreferencesSchema = z.object({
  notifications: notificationPreferencesSchema,
  /** Pre-selected when a new board is created. */
  defaultBoardVisibility: collectionVisibilitySchema,
  /** Images carrying any of these tags stay out of search and the explore feed. */
  mutedTags: z.array(mutedTagSchema).max(20),
  /** When false your public boards still open by link, but stay out of Explore. */
  discoverable: z.boolean(),
  /** Who may see who follows you, and who you follow. */
  followListsVisibleTo: audienceSchema,
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    itemAdded: true,
    itemUpdated: true,
    itemRemoved: true,
    collectionUpdated: true,
    memberAdded: true,
    collectionLiked: true,
  },
  defaultBoardVisibility: 'private',
  mutedTags: [],
  discoverable: true,
  followListsVisibleTo: 'everyone',
};

/** A patch changes only the switches it names; the rest keep their stored value. */
export const userPreferencesPatchSchema = z
  .object({
    notifications: notificationPreferencesSchema.partial(),
    defaultBoardVisibility: collectionVisibilitySchema,
    mutedTags: mutedTagsSchema,
    discoverable: z.boolean(),
    followListsVisibleTo: audienceSchema,
  })
  .partial();
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;

/** Applies a patch to a complete set of preferences. Nested switches merge one level deep. */
export function mergePreferences(
  base: UserPreferences,
  patch: UserPreferencesPatch,
): UserPreferences {
  return {
    notifications: { ...base.notifications, ...patch.notifications },
    defaultBoardVisibility: patch.defaultBoardVisibility ?? base.defaultBoardVisibility,
    mutedTags: patch.mutedTags ?? base.mutedTags,
    discoverable: patch.discoverable ?? base.discoverable,
    followListsVisibleTo: patch.followListsVisibleTo ?? base.followListsVisibleTo,
  };
}

/** Reads whatever is stored, however old or partial, into a complete set. */
export function parsePreferences(stored: unknown): UserPreferences {
  const parsed = userPreferencesPatchSchema.safeParse(stored);
  return mergePreferences(DEFAULT_USER_PREFERENCES, parsed.success ? parsed.data : {});
}
