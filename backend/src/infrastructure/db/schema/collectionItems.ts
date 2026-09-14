import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { collections } from './collections.js';
import { images } from './images.js';
import { users } from './users.js';

export const collectionItems = pgTable(
  'collection_items',
  {
    id: id(),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    imageId: uuid()
      .notNull()
      .references(() => images.id, { onDelete: 'restrict' }),
    // User deletion is out of scope; restrict keeps history intact if it is ever added.
    addedById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    caption: text().notNull().default(''),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    // An image appears at most once per board.
    uniqueIndex('collection_items_collection_image_idx').on(table.collectionId, table.imageId),
    index('collection_items_collection_position_idx').on(table.collectionId, table.position),
  ],
);
