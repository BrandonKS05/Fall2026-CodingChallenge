import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { conversationMemberState } from './enums.js';
import { conversations } from './conversations.js';
import { users } from './users.js';

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * Whether this person has taken the conversation. The one who starts it is
     * accepted at once; the other side is pending when the message arrives
     * unasked, and stays in their requests until they accept.
     */
    state: conversationMemberState().notNull().default('accepted'),
    /** Everything after this is unread. Starts at the moment they joined. */
    lastReadAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    // "Every conversation I am in", the query behind the inbox.
    index('conversation_members_user_idx').on(table.userId),
  ],
);
