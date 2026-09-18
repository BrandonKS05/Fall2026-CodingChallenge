/**
 * Turning candidates into a feed: the scoring, and the passes that stop a good
 * score from being the only thing that matters.
 *
 * No database here either. Candidate generation is the repository's job; this
 * decides what order they go in and which of them do not make it.
 */
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import type { Candidate } from '../../domain/entities/Recommendation.js';

const { maxPerAuthor, maxSharePerCentroid, recencyHalfLifeDays, explorationRatio } =
  RECOMMENDATIONS.ranking;

export type { Candidate };

/**
 * How fresh a picture still counts as. Halves every `recencyHalfLifeDays`, so
 * something from this morning outranks the same picture from last month
 * without ever ruling the older one out.
 */
export function recencyDecay(createdAt: Date, now: Date): number {
  const days = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000);
  return 0.5 ** (days / recencyHalfLifeDays);
}

/**
 * What other people's attention is worth, bounded between a half and one and a
 * half. Bounded on purpose: a picture nobody has touched yet is worth half as
 * much as a popular one, never nothing, or a new board could never be found.
 */
export function engagementQuality(engagement: number): number {
  return 0.5 + Math.tanh(Math.max(0, engagement) / 5);
}

/** similarity × recency × engagement, as one number to sort by. */
export function score(candidate: Candidate, now: Date): number {
  return (
    Math.max(0, candidate.similarity) *
    recencyDecay(candidate.createdAt, now) *
    engagementQuality(candidate.engagement)
  );
}

export interface SlateOptions {
  size: number;
  now: Date;
  /** Interleaved through the feed so it never collapses into one taste. */
  exploration: Candidate[];
  /**
   * How many interests this person actually holds. The share cap is meant to
   * stop one of several interests dominating; with one or two it would instead
   * cap the feed at 40% relevant and fill the rest with strangers, so the cap
   * is never tighter than an even split between the interests there are.
   */
  centroidCount?: number;
}

/**
 * The feed, in order.
 *
 * Best-scoring first, but three rules override the score: at most two from any
 * one person, at most a share of the feed from any one interest, and never the
 * same picture twice however many boards it sits on. Roughly one slot in seven
 * is given away to something the profile did not ask for, because a feed that
 * only ever confirms what it already believes stops being worth opening.
 */
export function assembleSlate(candidates: Candidate[], options: SlateOptions): string[] {
  const { size, now } = options;
  const evenSplit = Math.ceil(size / Math.max(1, options.centroidCount ?? Number.MAX_SAFE_INTEGER));
  const perCentroidCap = Math.max(1, evenSplit, Math.floor(size * maxSharePerCentroid));
  const exploreEvery = explorationRatio > 0 ? Math.round(1 / explorationRatio) : 0;

  const ranked = [...candidates].sort((a, b) => score(b, now) - score(a, now));
  const explorers = [...options.exploration];

  const chosen: string[] = [];
  const byAuthor = new Map<string, number>();
  const byCentroid = new Map<string, number>();
  const pictures = new Set<string>();
  let next = 0;

  const take = (candidate: Candidate): boolean => {
    if (pictures.has(candidate.imageId)) return false;
    if ((byAuthor.get(candidate.authorId) ?? 0) >= maxPerAuthor) return false;
    const centroid = candidate.centroidId;
    if (centroid !== null && (byCentroid.get(centroid) ?? 0) >= perCentroidCap) return false;

    chosen.push(candidate.itemId);
    pictures.add(candidate.imageId);
    byAuthor.set(candidate.authorId, (byAuthor.get(candidate.authorId) ?? 0) + 1);
    if (centroid !== null) byCentroid.set(centroid, (byCentroid.get(centroid) ?? 0) + 1);
    return true;
  };

  while (chosen.length < size && (next < ranked.length || explorers.length > 0)) {
    const wantsExplorer = exploreEvery > 0 && (chosen.length + 1) % exploreEvery === 0;
    const filled =
      wantsExplorer && explorers.length > 0
        ? takeFrom(explorers, take)
        : takeFrom(ranked, take, next);

    if (filled.taken) {
      if (filled.from === 'ranked') next = filled.cursor;
      continue;
    }
    // Whichever pile could not fill the slot, fall back to the other one.
    if (wantsExplorer) {
      const fallback = takeFrom(ranked, take, next);
      if (!fallback.taken) break;
      next = fallback.cursor;
    } else {
      if (explorers.length === 0) break;
      if (!takeFrom(explorers, take).taken) break;
    }
  }
  return chosen;
}

interface Filled {
  taken: boolean;
  cursor: number;
  from: 'ranked' | 'explorers';
}

/**
 * Walks forward until something is accepted. Rejected candidates are consumed,
 * not reconsidered: a picture turned away because its author is already twice
 * over will be turned away again.
 */
function takeFrom(
  pile: Candidate[],
  take: (candidate: Candidate) => boolean,
  from?: number,
): Filled {
  if (from === undefined) {
    while (pile.length > 0) {
      const candidate = pile.shift()!;
      if (take(candidate)) return { taken: true, cursor: 0, from: 'explorers' };
    }
    return { taken: false, cursor: 0, from: 'explorers' };
  }
  let cursor = from;
  while (cursor < pile.length) {
    const candidate = pile[cursor]!;
    cursor += 1;
    if (take(candidate)) return { taken: true, cursor, from: 'ranked' };
  }
  return { taken: false, cursor, from: 'ranked' };
}
