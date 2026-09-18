import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';
import { collections } from './collections.js';
import { notificationType } from './enums.js';
import { users } from './users.js';

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    recipientId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Null when nobody did it: a welcome comes from the app, not a person. */
    actorId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    /** Null when it is not about one board. */
    collectionId: uuid().references(() => collections.id, { onDelete: 'cascade' }),
    type: notificationType().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Serves both the unread badge and the newest-first list.
  (table) => [
    index('notifications_recipient_idx').on(table.recipientId, table.readAt, table.createdAt),
  ],
);
