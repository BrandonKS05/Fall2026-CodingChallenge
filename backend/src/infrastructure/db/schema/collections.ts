import { sql } from 'drizzle-orm';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { collectionVisibility } from './enums.js';
import { users } from './users.js';

export const collections = pgTable(
  'collections',
  {
    id: id(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text().notNull().default(''),
    visibility: collectionVisibility().notNull().default('private'),
    /** Random slug for link sharing; unique when present. */
    shareSlug: text().unique('collections_share_slug_unique'),
    ...timestamps,
  },
  (table) => [
    index('collections_owner_idx').on(table.ownerId),
    // Explore lists public boards newest first; a partial index keeps it cheap.
    index('collections_public_idx')
      .on(table.updatedAt)
      .where(sql`${table.visibility} = 'public'`),
  ],
);
