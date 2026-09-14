import { pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';

export const users = pgTable('users', {
  id: id(),
  /** Stored lowercased; the API contract normalizes before it gets here. */
  email: text().notNull().unique(),
  displayName: text().notNull(),
  /** Null when the account only signs in with Google. */
  passwordHash: text(),
  /** Google subject id; unique so one Google account maps to one user. */
  googleId: text().unique('users_google_id_unique'),
  ...timestamps,
});
