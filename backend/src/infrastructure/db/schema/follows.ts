import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const follows = pgTable(
  'follows',
  {
    followerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Following someone twice is the same as following them once.
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    // The other direction: "who follows this person", most recent first.
    index('follows_followee_idx').on(table.followeeId, table.createdAt.desc()),
  ],
);
