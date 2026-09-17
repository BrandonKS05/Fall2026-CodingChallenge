import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

/**
 * A ranked feed, frozen.
 *
 * Two of the requirements force this table rather than a keyset cursor. The
 * first is that scrolling must not reshuffle: centroids move every time the
 * reader likes something, and a cursor that re-ranks on each page would hand
 * back rows they have already scrolled past. The second is that "at most two
 * from one author" and "at most 40% from one centroid" are properties of a
 * whole feed, not of a page — a cursor that only remembers the last row it
 * emitted cannot enforce either.
 *
 * So page one ranks once, writes the order down, and every later page is a
 * slice of this array. The row id is the pagination cursor.
 */
export const feedSlates = pgTable(
  'feed_slates',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The ranked item ids, in the order they will be served. */
    itemIds: uuid().array().notNull(),
    /** After this, the reader has stopped scrolling and the next visit re-ranks. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('feed_slates_user_idx').on(table.userId, table.createdAt.desc()),
    // Swept by the same job that trims impressions.
    index('feed_slates_expiry_idx').on(table.expiresAt),
  ],
);
