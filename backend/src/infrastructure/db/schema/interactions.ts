import { sql } from 'drizzle-orm';
import { index, integer, pgTable, real, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';
import { collectionItems } from './collectionItems.js';
import { interactionType } from './enums.js';
import { users } from './users.js';

/**
 * Everything a person has done with a picture: the raw evidence the interest
 * profile is built from. Centroids are a summary of this table and can always
 * be rebuilt from it, which is what makes re-tuning the weights survivable.
 */
export const interactions = pgTable(
  'interactions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid()
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    type: interactionType().notNull(),
    /** The weight as applied, so changing the config never rewrites the past. */
    weight: real().notNull(),
    /** Null for everything but a view. */
    dwellMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Rebuilding a profile reads one person's history newest first.
    index('interactions_user_time_idx').on(table.userId, table.createdAt.desc()),
    /**
     * A like is a like however many times it is clicked, and the same goes for
     * a save, a share and a hide. Views are not deliberate and do repeat, so
     * they sit outside the constraint.
     */
    uniqueIndex('interactions_user_item_act_idx')
      .on(table.userId, table.itemId, table.type)
      .where(sql`${table.type} <> 'view'`),
  ],
);
