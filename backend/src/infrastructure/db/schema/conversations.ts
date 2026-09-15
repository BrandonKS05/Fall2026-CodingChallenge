import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';

export const conversations = pgTable('conversations', {
  id: id(),
  /**
   * The two member ids, sorted and joined, for a one-to-one conversation. It is
   * what makes "message this person" idempotent without scanning memberships.
   * Null would mean a group conversation, which nothing creates yet.
   */
  directKey: text().unique('conversations_direct_key_unique'),
  /** Sorts the inbox. Set at creation so a new, empty conversation still appears. */
  lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});
