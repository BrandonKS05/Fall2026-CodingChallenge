import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { collections } from './collections.js';
import { users } from './users.js';

/** One row per person per board they like; the pair is the key, so a like is idempotent. */
export const collectionLikes = pgTable(
  'collection_likes',
  {
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.userId] }),
    index('collection_likes_collection_idx').on(table.collectionId),
  ],
);