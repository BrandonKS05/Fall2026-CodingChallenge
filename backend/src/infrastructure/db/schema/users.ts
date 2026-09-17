import type { UserPreferences } from '@wumboo/shared';
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';

export const users = pgTable('users', {
  id: id(),
  /** Stored lowercased; the API contract normalizes before it gets here. */
  email: text().notNull().unique(),
  /** When the address was proved by a code. Null while it is only claimed. */
  emailVerifiedAt: timestamp({ withTimezone: true }),
  displayName: text().notNull(),
  /** The name people are found by: lowercase and unique. */
  handle: text().notNull().unique('users_handle_unique'),
  /** When the handle last changed; null while it is still the one chosen at sign-up. */
  handleChangedAt: timestamp({ withTimezone: true }),
  /** Null when the account only signs in with Google. */
  passwordHash: text(),
  /** Google subject id; unique so one Google account maps to one user. */
  googleId: text().unique('users_google_id_unique'),
  /** Shown on the person's own page. Empty until they write one. */
  bio: text().notNull().default(''),
  /** Account settings as one document; absent keys fall back to the shared defaults. */
  preferences: jsonb().$type<Partial<UserPreferences>>().notNull().default({}),
  /** Bumped to invalidate every session token issued so far. */
  sessionVersion: integer().notNull().default(0),
  ...timestamps,
});
