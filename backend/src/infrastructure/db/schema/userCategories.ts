import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { searchCategory } from './enums.js';
import { users } from './users.js';

/** What somebody ticked at sign-up. Kept so a profile can be re-seeded from scratch. */
export const userCategories = pgTable(
  'user_categories',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: searchCategory().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.category] })],
);
