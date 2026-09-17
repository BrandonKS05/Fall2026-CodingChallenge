import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { id } from './_helpers.js';
import { imageProvider } from './enums.js';

export const images = pgTable(
  'images',
  {
    id: id(),
    provider: imageProvider().notNull(),
    providerImageId: text().notNull(),
    /** Key understood by the StorageBackend that holds the downloaded file. */
    storageKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    blurhash: text(),
    palette: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    creditName: text().notNull(),
    creditUrl: text(),
    sourceUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // One row per provider image, so saving the same photo twice reuses the download.
  (table) => [uniqueIndex('images_provider_image_idx').on(table.provider, table.providerImageId)],
);
