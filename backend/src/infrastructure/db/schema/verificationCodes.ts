import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { verificationChannel } from './enums.js';

/**
 * One issued code. The code itself is never stored — only a hash of it — so a
 * leaked database cannot be used to walk into accounts, exactly as with
 * passwords. A row is kept after use so a code cannot be replayed, and the
 * sweep of expired rows is left to whoever runs the database.
 */
export const verificationCodes = pgTable(
  'verification_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    channel: verificationChannel().notNull(),
    /** The email address or the E.164 phone number the code was sent to. */
    target: text().notNull(),
    codeHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Wrong guesses so far; a code is spent once there have been too many. */
    attempts: integer().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('verification_codes_target_idx').on(table.channel, table.target)],
);
