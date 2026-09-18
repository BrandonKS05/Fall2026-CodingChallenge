/**
 * One vector per embedded thing.
 *
 * The width is decided by whichever model the embedding service calls and is
 * baked into the Postgres column type, so changing it costs a migration and a
 * re-embed of every row. That makes it a fact about the system rather than a
 * tuning knob, which is why it lives here and not in the recommendations config.
 */

/** text-embedding-3-small's native width. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Unit length by construction: every vector is normalized before it is written.
 * That is what lets the database rank with inner product instead of cosine
 * distance — for unit vectors the two orderings are the same, and the inner
 * product is the cheaper of them.
 */
export type Embedding = number[];

/**
 * The words a saved picture is embedded from: what the person wrote, the tags
 * they gave it, and the tags it arrived with.
 */
export interface EmbeddableItem {
  caption: string;
  tags: string[];
  image: { tags: string[] };
}
