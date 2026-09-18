import { describe, expect, it } from 'vitest';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import { InMemoryInterestProfileRepository } from '../../testing/fakes/InMemoryInterestProfileRepository.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { RecommendationService } from './RecommendationService.js';
import type { FeedItem, FeedRepository } from './ports/FeedRepository.js';
import type { Candidate } from './ranking.js';

const NOW = new Date('2026-09-17T12:00:00Z');
const USER = 'u1';

/** A pool of public pictures, each by a different person, ranked by their index. */
function pool(count: number, prefix = 'p'): Candidate[] {
  return Array.from({ length: count }, (_, index) => ({
    itemId: `${prefix}${index}`,
    imageId: `${prefix}img${index}`,
    authorId: `${prefix}author${index}`,
    createdAt: NOW,
    similarity: 1 - index / (count * 2),
    engagement: count - index,
    centroidId: null,
  }));
}

/** Records what was asked of it, so a test can check what was and was not done. */
function fakeFeed(available: Candidate[], popular: Candidate[] = []) {
  const slates = new Map<string, string[]>();
  const impressions: string[] = [];
  let next = 0;
  const repository: FeedRepository = {
    findNearest: (_userId, _vector, limit) => Promise.resolve(available.slice(0, limit)),
    findPopular: (_userId, limit) => Promise.resolve(popular.slice(0, limit)),
    createSlate: (_userId, itemIds) => {
      const id = `slate${next++}`;
      slates.set(id, itemIds);
      return Promise.resolve(id);
    },
    findSlate: (id) => Promise.resolve(slates.get(id) ?? null),
    findItems: (itemIds) => Promise.resolve(itemIds.map((id) => ({ id }) as unknown as FeedItem)),
    recordImpressions: (_userId, itemIds) => {
      impressions.push(...itemIds);
      return Promise.resolve();
    },
    forget: () => Promise.resolve(),
  };
  return { repository, slates, impressions };
}

function build(available: Candidate[], popular: Candidate[] = []) {
  const feed = fakeFeed(available, popular);
  const profiles = new InMemoryInterestProfileRepository();
  const service = new RecommendationService({
    feed: feed.repository,
    profiles,
    logger: silentLogger,
    now: () => NOW,
  });
  return { ...feed, profiles, service };
}

const withInterest = async (profiles: InMemoryInterestProfileRepository, count = 1) => {
  for (let index = 0; index < count; index += 1) {
    await profiles.insertCentroid(USER, {
      centroid: [1, 0, 0],
      weight: 1,
      origin: 'interaction',
    });
  }
};

describe('getRecommendations', () => {
  it('hands back a page and a cursor for the next one', async () => {
    const { service, profiles } = build(pool(40));
    await withInterest(profiles);

    const first = await service.getRecommendations(USER, 10);

    expect(first.items).toHaveLength(10);
    expect(first.cursor).toMatch(/^slate0:10$/);
  });

  it('does not reshuffle or repeat when the profile changes mid-scroll', async () => {
    const { service, profiles } = build(pool(40));
    await withInterest(profiles);

    const first = await service.getRecommendations(USER, 10);
    // The reader likes something: their taste moves under them.
    await withInterest(profiles, 3);

    const second = await service.getRecommendations(USER, 10, first.cursor ?? undefined);
    const seen = first.items.map((item) => item.id);
    const next = second.items.map((item) => item.id);

    expect(next).toHaveLength(10);
    expect(next.some((id) => seen.includes(id))).toBe(false);
    // Still the same frozen order: page two is a slice, not a new ranking.
    expect(second.cursor).toBe('slate0:20');
  });

  it('runs out rather than repeating itself', async () => {
    const { service, profiles } = build(pool(12));
    await withInterest(profiles);

    const first = await service.getRecommendations(USER, 10);
    const second = await service.getRecommendations(USER, 10, first.cursor ?? undefined);

    expect(second.items.length).toBeLessThanOrEqual(2);
    expect(second.cursor).toBeNull();
  });

  it('starts a fresh feed for a cursor that has expired or is not theirs', async () => {
    const { service, profiles } = build(pool(40));
    await withInterest(profiles);

    const page = await service.getRecommendations(USER, 5, 'slate-that-went:20');

    expect(page.items).toHaveLength(5);
    expect(page.cursor).toBe('slate0:5');
  });

  it('gives somebody with no interests yet a feed of what other people like', async () => {
    const { service } = build([], pool(60, 'hot'));

    const page = await service.getRecommendations(USER, 10);

    expect(page.items).toHaveLength(10);
    expect(page.items.every((item) => item.id.startsWith('hot'))).toBe(true);
  });

  it('remembers what it showed, so tomorrow is not the same feed', async () => {
    const { service, profiles, impressions } = build(pool(40));
    await withInterest(profiles);

    const page = await service.getRecommendations(USER, 8);

    expect(impressions).toEqual(page.items.map((item) => item.id));
  });

  it('never ranks more than one slate deep', async () => {
    const { service, profiles, slates } = build(pool(400));
    await withInterest(profiles);

    const page = await service.getRecommendations(USER, 10);

    expect(slates.get('slate0')?.length).toBeLessThanOrEqual(RECOMMENDATIONS.ranking.slateSize);
    expect(page.items).toHaveLength(10);
  });
});
