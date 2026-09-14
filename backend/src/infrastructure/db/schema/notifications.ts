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
    actorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
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
