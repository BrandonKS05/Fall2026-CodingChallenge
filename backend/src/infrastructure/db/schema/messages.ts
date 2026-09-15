import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';
import { conversations } from './conversations.js';
import { users } from './users.js';

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Deleting an account takes its messages with it, as the settings copy promises. */
    senderId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * The hot path: one conversation's history, newest first, and the keyset
     * pages behind it. The id breaks ties so two messages in the same
     * millisecond still have one stable order.
     */
    index('messages_conversation_created_idx').on(
      table.conversationId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
