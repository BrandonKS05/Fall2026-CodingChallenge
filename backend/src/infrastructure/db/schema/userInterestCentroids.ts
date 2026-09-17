import { index, integer, pgTable, real, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS } from '../../../domain/entities/Embedding.js';
import { id, timestamps } from './_helpers.js';
import { centroidOrigin } from './enums.js';
import { users } from './users.js';

/**
 * A few points per person rather than one. There is no vector index here on
 * purpose: nobody holds more than a handful, so reading all of somebody's
 * centroids is one small sequential read, and an HNSW graph over a table
 * partitioned by user would only get in the way.
 */
export const userInterestCentroids = pgTable(
  'user_interest_centroids',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    centroid: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    /** Accumulated interaction weight: how much evidence stands behind this cluster. */
    weight: real().notNull().default(0),
    interactionCount: integer().notNull().default(0),
    origin: centroidOrigin().notNull(),
    /** Last time something was blended in; eviction reads this as staleness. */
    lastReinforcedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [index('user_interest_centroids_user_idx').on(table.userId)],
);
