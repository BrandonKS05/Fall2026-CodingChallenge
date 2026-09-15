import { bigserial, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';
import { conversations } from './conversations.js';
import { users } from './users.js';

export const messages = pgTable(
  'messages',
  {
    id: id(),
    /**
     * Insertion order, and the only thing history is sorted or paged by.
     * `created_at` is a clock: two messages can share one, and a tie then falls
     * to a random uuid, which can order a conversation wrongly and even drop a
     * message from a keyset page. A sequence cannot tie.
     */
    seq: bigserial({ mode: 'number' }).notNull().unique('messages_seq_unique'),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** Deleting an account takes its messages with it, as the settings copy promises. */
    senderId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    /** Shown to people; never used to order anything. */
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // The hot path: one conversation's history, newest first, and the pages behind it.
  (table) => [index('messages_conversation_seq_idx').on(table.conversationId, table.seq.desc())],
);
