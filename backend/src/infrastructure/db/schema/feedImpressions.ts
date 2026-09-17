import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { collectionItems } from './collectionItems.js';
import { users } from './users.js';

/**
 * What has already been put in front of somebody, so the feed stops offering
 * it. One row per person per picture — the primary key makes recording an
 * impression idempotent and the anti-join an index lookup — and rows older
 * than the retention window are deleted, which is what keeps it from growing
 * without bound.
 *
 * At this size that bound is generous: a few hundred readers against a few
 * thousand pictures cannot exceed a few million rows even if everyone saw
 * everything, and the retention sweep means in practice it settles far below
 * that. The thing that breaks this shape is users x items getting large enough
 * that the table outgrows memory; the answer then is a roaring bitmap or a
 * Bloom filter per reader, trading exactness for a fixed size per row.
 */
export const feedImpressions = pgTable(
  'feed_impressions',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemId: uuid()
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
    servedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.itemId] }),
    index('feed_impressions_served_idx').on(table.servedAt),
  ],
);
