/**
 * A picture in the running for somebody's feed, with everything the ranking
 * needs to judge it and nothing it does not.
 */
export interface Candidate {
  itemId: string;
  /** The picture behind it: the same photo saved by five people is one picture. */
  imageId: string;
  authorId: string;
  createdAt: Date;
  /** Cosine against the interest that found it; 0 for one found by exploring. */
  similarity: number;
  /** How many people have saved this picture or liked the board it is on. */
  engagement: number;
  /** Which interest turned it up, or null when nothing did. */
  centroidId: string | null;
}
