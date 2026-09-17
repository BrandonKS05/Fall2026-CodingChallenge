import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS } from '../../../domain/entities/Embedding.js';
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
      // An account that leaves takes the images it added with it, wherever they were saved.
      .references(() => users.id, { onDelete: 'cascade' }),
    caption: text().notNull().default(''),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    position: integer().notNull().default(0),
    /**
     * Whether this sits on a board anyone can see. Visibility belongs to the
     * board, but a partial index cannot reach across a join, so it is copied
     * down here by trigger and is the thing the recommendation index is built
     * over. Follower-only and unlisted boards are deliberately not included:
     * a feed that suggested them would leak them.
     */
    isPublic: boolean().notNull().default(false),
    /** Null until the embedding service has been round the queue. */
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    embeddedAt: timestamp({ withTimezone: true }),
    /**
     * Digest of the text that produced the vector. An edit to the caption or
     * the tags changes it, which is how the worker knows to embed this again
     * without embedding everything again.
     */
    embeddingInputHash: text(),
    /** Failed attempts, so a picture the model keeps choking on stops being retried. */
    embeddingAttempts: smallint().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    // An image appears at most once per board.
    uniqueIndex('collection_items_collection_image_idx').on(table.collectionId, table.imageId),
    index('collection_items_collection_position_idx').on(table.collectionId, table.position),
    /**
     * The recommendation index. Inner product, because every vector is stored
     * normalized; partial, because a feed only ever draws from public boards
     * that have actually been embedded, and an index over the rest would be
     * pages of nothing.
     *
     * m = 16 and ef_construction = 64 are pgvector's defaults, written out so
     * they are visible. At a few thousand rows they are already generous: the
     * graph fits in memory several times over and recall sits near 1. m is the
     * knob to raise (24-32) past roughly a million rows, where the graph gets
     * deep enough for a search to get stranded; ef_construction is the one to
     * raise if recall disappoints, at the cost of build time only.
     */
    index('collection_items_embedding_idx')
      .using('hnsw', table.embedding.op('vector_ip_ops'))
      .with({ m: 16, ef_construction: 64 })
      .where(sql`${table.isPublic} and ${table.embedding} is not null`),
    /** The work queue: what still needs a vector, oldest first. */
    index('collection_items_embedding_pending_idx')
      .on(table.createdAt)
      .where(sql`${table.embedding} is null`),
  ],
);
