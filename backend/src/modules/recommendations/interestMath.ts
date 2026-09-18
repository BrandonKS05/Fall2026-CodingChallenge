/**
 * The arithmetic of a taste profile, with no database in sight.
 *
 * Every vector here is unit length, which is what lets a dot product stand in
 * for cosine similarity: the two agree exactly when both sides are normalized,
 * and the dot product is the cheaper of them.
 */
import type { CentroidOrigin } from '../../domain/entities/InterestCentroid.js';

export interface Centroid {
  centroid: number[];
  weight: number;
  origin: CentroidOrigin;
  lastReinforcedAt: Date;
}

/** Cosine similarity of two unit vectors, which is their dot product. */
export function similarity(a: number[], b: number[]): number {
  let total = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) total += a[index]! * b[index]!;
  return total;
}

/** Scales back to unit length. A vector with no direction is left as it is. */
export function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const length = Math.sqrt(sum);
  return length === 0 ? vector : vector.map((value) => value / length);
}

/**
 * How far a single interaction is allowed to move an interest.
 *
 * The configured alpha is the step for an action worth 1. A save, worth more,
 * moves it further; a view, worth a tenth, barely nudges it. Clamped below 1
 * so no single act can replace an interest outright — taste is a running
 * average, not a last-write-wins.
 */
export function stepSize(alpha: number, weight: number): number {
  return Math.min(Math.abs(alpha * weight), 0.9);
}

/**
 * Exponential moving average, renormalized: the interest slides towards the
 * picture without ever leaving the unit sphere the index lives on.
 */
export function blendToward(centroid: number[], vector: number[], step: number): number[] {
  return normalize(
    centroid.map((value, index) => value * (1 - step) + (vector[index] ?? 0) * step),
  );
}

/**
 * The opposite, for a hide. Moving away from a picture is a real signal about
 * an interest somebody already has; it is never a reason to invent a new one,
 * which is why nothing here spawns.
 */
export function blendAway(centroid: number[], vector: number[], step: number): number[] {
  return normalize(centroid.map((value, index) => value - (vector[index] ?? 0) * step));
}

export interface Nearest {
  index: number;
  similarity: number;
}

/** The interest a picture belongs to, if it belongs to any of them. */
export function nearestCentroid(centroids: Centroid[], vector: number[]): Nearest | null {
  let best: Nearest | null = null;
  for (const [index, entry] of centroids.entries()) {
    const score = similarity(entry.centroid, vector);
    if (!best || score > best.similarity) best = { index, similarity: score };
  }
  return best;
}

/**
 * What an interest is worth keeping for: how much evidence stands behind it,
 * faded by how long ago that evidence last arrived. A seed nobody has acted on
 * is worth a fraction of one somebody keeps returning to, which is why the
 * categories ticked at sign-up are the first to go when the cap is reached.
 */
export function keepScore(centroid: Centroid, now: Date, stalenessDays: number): number {
  const days = Math.max(0, (now.getTime() - centroid.lastReinforcedAt.getTime()) / 86_400_000);
  const freshness = Math.exp(-days / stalenessDays);
  const earned = centroid.origin === 'category-seed' ? 0.25 : 1;
  return Math.max(centroid.weight, 0) * freshness * earned;
}

/** Which interest to drop when there is no room for a new one. */
export function weakestCentroid(centroids: Centroid[], now: Date, stalenessDays: number): number {
  let worst = 0;
  let worstScore = Number.POSITIVE_INFINITY;
  for (const [index, entry] of centroids.entries()) {
    const score = keepScore(entry, now, stalenessDays);
    if (score < worstScore) {
      worstScore = score;
      worst = index;
    }
  }
  return worst;
}

/**
 * Turns the categories somebody ticked into a small number of starting points.
 *
 * Ticking five categories should not spend five of the eight interests anybody
 * is allowed, and three of them may well be the same taste in different words.
 * So: pick the most spread-out few as anchors (each new anchor is the one least
 * like everything chosen so far), then fold every remaining pick into whichever
 * anchor it is closest to. Someone who picks nature, animals and travel gets
 * one outdoors interest rather than three near-identical ones.
 */
export function seedCentroids(vectors: number[][], max: number): number[][] {
  if (vectors.length === 0 || max <= 0) return [];
  if (vectors.length <= max) return vectors.map(normalize);

  const anchors = [0];
  while (anchors.length < max) {
    let furthest = -1;
    let furthestScore = Number.POSITIVE_INFINITY;
    for (const [index] of vectors.entries()) {
      if (anchors.includes(index)) continue;
      // How like the chosen set this one already is: its nearest anchor.
      const nearest = Math.max(
        ...anchors.map((anchor) => similarity(vectors[index]!, vectors[anchor]!)),
      );
      if (nearest < furthestScore) {
        furthestScore = nearest;
        furthest = index;
      }
    }
    if (furthest === -1) break;
    anchors.push(furthest);
  }

  const sums = anchors.map((anchor) => [...vectors[anchor]!]);
  for (const [index, vector] of vectors.entries()) {
    if (anchors.includes(index)) continue;
    let nearest = 0;
    let nearestScore = Number.NEGATIVE_INFINITY;
    for (const [slot, anchor] of anchors.entries()) {
      const score = similarity(vector, vectors[anchor]!);
      if (score > nearestScore) {
        nearestScore = score;
        nearest = slot;
      }
    }
    const sum = sums[nearest]!;
    for (const [axis, value] of vector.entries()) sum[axis] = (sum[axis] ?? 0) + value;
  }
  return sums.map(normalize);
}
