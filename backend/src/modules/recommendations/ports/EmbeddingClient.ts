/**
 * Turns words into vectors. The only thing the rest of the recommender knows
 * about whichever model is behind it.
 */
export interface EmbeddingClient {
  /**
   * One vector per text, in the order given, each of unit length. Batching,
   * retries and the provider's own limits are the adapter's business.
   *
   * Throws only when a batch could not be embedded after every attempt.
   */
  embed(texts: string[]): Promise<number[][]>;
}

/** Scales a vector to unit length, so the database can rank with inner product. */
export function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const length = Math.sqrt(sum);
  // A zero vector has no direction to preserve; it is returned as it came.
  return length === 0 ? vector : vector.map((value) => value / length);
}
