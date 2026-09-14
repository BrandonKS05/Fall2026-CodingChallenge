import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { collections } from './collections.js';
import { collectionRole } from './enums.js';
import { users } from './users.js';

/**
 * Every collection has one 'owner' row here, mirroring collections.owner_id,
 * so authorization is a single lookup regardless of role.
 */
export const collectionMembers = pgTable(
  'collection_members',
  {
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: collectionRole().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.userId] }),
    // "Shared with me" looks up by user.
    index('collection_members_user_idx').on(table.userId),
  ],
);
