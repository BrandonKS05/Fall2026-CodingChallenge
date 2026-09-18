import type { EmbeddableItem } from '../../../domain/entities/Embedding.js';

/** A saved picture as the embedding worker needs to see it. */
export interface EmbeddableRow extends EmbeddableItem {
  id: string;
  /** The digest of the text behind the current vector, or null if there isn't one. */
  inputHash: string | null;
}

export interface SavedEmbedding {
  id: string;
  embedding: number[];
  inputHash: string;
}

/**
 * The queue is the table: a picture needs a vector exactly while its embedding
 * column is null. Nothing is held in memory, so a restart mid-batch loses no
 * work and repeats at most one batch.
 */
export interface EmbeddingRepository {
  /** Pictures still waiting, oldest first, skipping the ones that have failed too often. */
  claimPending(limit: number, maxAttempts: number): Promise<EmbeddableRow[]>;
  /** The same shape for named pictures, so an edit can be compared against its hash. */
  findByIds(ids: string[]): Promise<EmbeddableRow[]>;
  save(entries: SavedEmbedding[]): Promise<void>;
  /** One more failed attempt each, so a picture the model keeps refusing is eventually left alone. */
  recordFailure(ids: string[]): Promise<void>;
  /** Puts these beyond retrying: there is nothing about them to embed. */
  skip(ids: string[]): Promise<void>;
  /** Drops the vector so the worker picks the picture up again. */
  clearEmbedding(ids: string[]): Promise<void>;
  countPending(maxAttempts: number): Promise<number>;
}
