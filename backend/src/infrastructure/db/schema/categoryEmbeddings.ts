import { pgTable, text, timestamp, vector } from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS } from '../../../domain/entities/Embedding.js';
import { searchCategory } from './enums.js';

/**
 * One vector per category on the browse grid, embedded once from a written
 * description rather than from the word alone — "nature" on its own is a poor
 * anchor, "forests, coastline, weather, animals in the wild" is a good one.
 * These seed a new account's profile and never change unless the text does.
 */
export const categoryEmbeddings = pgTable('category_embeddings', {
  category: searchCategory().primaryKey(),
  embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  /** What was embedded, so a re-seed can tell whether it has anything to do. */
  sourceText: text().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
