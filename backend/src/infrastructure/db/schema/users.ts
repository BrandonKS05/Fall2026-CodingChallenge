import { pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';

export const users = pgTable('users', {
  id: id(),
  /** Stored lowercased; the API contract normalizes before it gets here. */
  email: text().notNull().unique(),
  displayName: text().notNull(),
  passwordHash: text().notNull(),
  ...timestamps,
});
