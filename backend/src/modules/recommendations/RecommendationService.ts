/**
 * The "You may like" feed.
 *
 * Page one ranks once and writes the order down; every later page is a slice of
 * that frozen list. Two requirements force it. Scrolling must not reshuffle,
 * and centroids move every time the reader likes something — a cursor that
 * re-ranked would hand back rows they had already passed. And "at most two from
 * one person" and "at most a share from one interest" are properties of a whole
 * feed, which a cursor that remembers only its last row cannot enforce.
 *
 * Cold start has two halves. Somebody with no interests yet gets what is public,
 * recent and acted on; a picture with no engagement yet is still reachable,
 * because engagement is a bounded multiplier rather than a gate.
 */
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { FeedItem, FeedRepository } from './ports/FeedRepository.js';
import type { InterestProfileRepository } from './ports/InterestProfileRepository.js';
import { assembleSlate, type Candidate } from './ranking.js';

const { candidatesPerCentroid, explorationRatio, slateSize, slateTtlMinutes } =
  RECOMMENDATIONS.ranking;

export interface Recommendations {
  items: FeedItem[];
  /** Feed it back to get the next page. Null when the feed has run out. */
  cursor: string | null;
  /** False while there is no profile behind it and it is only what is popular. */
  personalised: boolean;
}

export interface RecommendationServiceDeps {
  feed: FeedRepository;
  profiles: InterestProfileRepository;
  logger: Logger;
  now?: () => Date;
}

export class RecommendationService {
  constructor(private readonly deps: RecommendationServiceDeps) {}

  async getRecommendations(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<Recommendations> {
    const resumed = cursor ? await this.resume(userId, cursor) : null;
    const { slateId, itemIds, offset } = resumed ?? (await this.build(userId));
    // Asked on every page, not only the first: somebody who picks their
    // interests mid-scroll should stop being told to.
    const personalised = (await this.deps.profiles.findCentroids(userId)).length > 0;

    const page = itemIds.slice(offset, offset + limit);
    const items = await this.deps.feed.findItems(page);
    // Recorded on the way out, so a picture that was actually put in front of
    // somebody is not offered to them again tomorrow.
    await this.deps.feed.recordImpressions(userId, page);

    const nextOffset = offset + page.length;
    return {
      items,
      cursor: nextOffset < itemIds.length ? `${slateId}:${nextOffset}` : null,
      personalised,
    };
  }

  /** Housekeeping: both feed tables are bounded by the retention window, not by use. */
  async forgetOld(): Promise<void> {
    const cutoff = new Date(this.now().getTime() - RECOMMENDATIONS.seen.retentionDays * 86_400_000);
    await this.deps.feed.forget(cutoff);
  }

  /**
   * A cursor is a slate and a position in it. An unreadable, expired or
   * someone else's cursor is not an error — it is a reader who has been away,
   * and they get a fresh feed rather than a failure.
   */
  private async resume(
    userId: string,
    cursor: string,
  ): Promise<{ slateId: string; itemIds: string[]; offset: number } | null> {
    const separator = cursor.lastIndexOf(':');
    if (separator <= 0) return null;
    const slateId = cursor.slice(0, separator);
    const offset = Number.parseInt(cursor.slice(separator + 1), 10);
    if (!Number.isInteger(offset) || offset < 0) return null;

    const itemIds = await this.deps.feed.findSlate(slateId, userId);
    return itemIds ? { slateId, itemIds, offset } : null;
  }

  private async build(
    userId: string,
  ): Promise<{ slateId: string; itemIds: string[]; offset: number }> {
    const centroids = await this.deps.profiles.findCentroids(userId);

    // One search per interest, each candidate remembering which interest found
    // it so the share cap has something to count.
    const perInterest = await Promise.all(
      centroids.map(async (centroid) => {
        const found = await this.deps.feed.findNearest(
          userId,
          centroid.centroid,
          candidatesPerCentroid,
        );
        return found.map((candidate): Candidate => ({ ...candidate, centroidId: centroid.id }));
      }),
    );
    const candidates = perInterest.flat();

    // Enough to fill the exploring share twice over, so the diversity rules
    // have something to reject without leaving holes.
    const exploration = await this.deps.feed.findPopular(
      userId,
      Math.max(10, Math.ceil(slateSize * explorationRatio * 2)),
    );

    const itemIds = assembleSlate(candidates, {
      size: slateSize,
      now: this.now(),
      // With no profile at all, everything is exploring.
      exploration: candidates.length === 0 ? [...exploration, ...exploration] : exploration,
      centroidCount: centroids.length,
    });

    const expiresAt = new Date(this.now().getTime() + slateTtlMinutes * 60_000);
    const slateId = await this.deps.feed.createSlate(userId, itemIds, expiresAt);
    this.deps.logger.debug(
      { userId, interests: centroids.length, candidates: candidates.length, size: itemIds.length },
      'Ranked a feed',
    );
    return { slateId, itemIds, offset: 0 };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}
