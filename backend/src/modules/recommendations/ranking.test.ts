import { describe, expect, it } from 'vitest';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import {
  assembleSlate,
  engagementQuality,
  recencyDecay,
  score,
  type Candidate,
} from './ranking.js';

const NOW = new Date('2026-09-17T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const { maxPerAuthor, maxSharePerCentroid, recencyHalfLifeDays } = RECOMMENDATIONS.ranking;

let serial = 0;
const candidate = (overrides: Partial<Candidate> = {}): Candidate => {
  serial += 1;
  return {
    itemId: `item-${serial}`,
    imageId: `image-${serial}`,
    authorId: `author-${serial}`,
    createdAt: NOW,
    similarity: 0.8,
    engagement: 0,
    centroidId: 'c1',
    ...overrides,
  };
};

describe('recencyDecay', () => {
  it('halves over the half-life and never reaches zero', () => {
    expect(recencyDecay(NOW, NOW)).toBeCloseTo(1, 10);
    expect(recencyDecay(daysAgo(recencyHalfLifeDays), NOW)).toBeCloseTo(0.5, 10);
    expect(recencyDecay(daysAgo(365), NOW)).toBeGreaterThan(0);
  });
});

describe('engagementQuality', () => {
  it('rewards attention without ruling out a picture that has had none', () => {
    expect(engagementQuality(0)).toBe(0.5);
    expect(engagementQuality(10)).toBeGreaterThan(engagementQuality(1));
    // Bounded, so a runaway hit cannot swamp relevance.
    expect(engagementQuality(10_000)).toBeLessThanOrEqual(1.5);
  });
});

describe('score', () => {
  it('prefers the closer picture when everything else is equal', () => {
    const near = candidate({ similarity: 0.9 });
    const far = candidate({ similarity: 0.4 });
    expect(score(near, NOW)).toBeGreaterThan(score(far, NOW));
  });

  it('prefers the newer one, and the one people have acted on', () => {
    expect(score(candidate({ createdAt: NOW }), NOW)).toBeGreaterThan(
      score(candidate({ createdAt: daysAgo(60) }), NOW),
    );
    expect(score(candidate({ engagement: 20 }), NOW)).toBeGreaterThan(
      score(candidate({ engagement: 0 }), NOW),
    );
  });

  it('is never negative, however unlike an interest a picture is', () => {
    expect(score(candidate({ similarity: -0.5 }), NOW)).toBe(0);
  });
});

describe('assembleSlate', () => {
  it('puts the best first', () => {
    const weak = candidate({ itemId: 'weak', similarity: 0.2 });
    const strong = candidate({ itemId: 'strong', similarity: 0.95 });
    expect(assembleSlate([weak, strong], { size: 2, now: NOW, exploration: [] })[0]).toBe('strong');
  });

  it('never shows the same picture twice, however many boards it is on', () => {
    const saves = Array.from({ length: 5 }, () =>
      candidate({ imageId: 'one-photo', authorId: `a${serial}` }),
    );
    expect(assembleSlate(saves, { size: 10, now: NOW, exploration: [] })).toHaveLength(1);
  });

  it('takes no more than two from any one person', () => {
    const hoarder = Array.from({ length: 8 }, () => candidate({ authorId: 'prolific' }));
    const slate = assembleSlate(hoarder, { size: 8, now: NOW, exploration: [] });
    expect(slate).toHaveLength(maxPerAuthor);
  });

  it('keeps any one interest to its share of the feed', () => {
    const size = 20;
    const fromOne = Array.from({ length: 40 }, () => candidate({ centroidId: 'c1' }));
    const fromAnother = Array.from({ length: 40 }, () => candidate({ centroidId: 'c2' }));
    const slate = assembleSlate([...fromOne, ...fromAnother], {
      size,
      now: NOW,
      exploration: [],
    });

    const cap = Math.floor(size * maxSharePerCentroid);
    const counts = new Map<string, number>();
    for (const id of slate) {
      const owner = [...fromOne, ...fromAnother].find((entry) => entry.itemId === id)!.centroidId!;
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(cap);
  });

  it('gives roughly a seventh of the feed to something nobody asked for', () => {
    const matched = Array.from({ length: 60 }, (_, index) =>
      candidate({ authorId: `m${serial}`, centroidId: `c${index % 6}` }),
    );
    const explorers = Array.from({ length: 30 }, () =>
      candidate({ centroidId: null, similarity: 0, authorId: `x${serial}` }),
    );
    const explorerIds = new Set(explorers.map((entry) => entry.itemId));

    const slate = assembleSlate(matched, {
      size: 21,
      now: NOW,
      exploration: explorers,
      centroidCount: 6,
    });
    const explored = slate.filter((id) => explorerIds.has(id)).length;

    expect(slate).toHaveLength(21);
    // 15% of 21 is about three.
    expect(explored).toBeGreaterThanOrEqual(2);
    expect(explored).toBeLessThanOrEqual(5);
  });

  it('fills the feed from whichever pile has something left', () => {
    const matched = Array.from({ length: 30 }, (_, index) =>
      candidate({ authorId: `m${serial}`, centroidId: `c${index % 4}` }),
    );
    // Nothing to explore with: the feed is still full.
    expect(
      assembleSlate(matched, { size: 12, now: NOW, exploration: [], centroidCount: 4 }),
    ).toHaveLength(12);

    // Nothing matched: the feed is entirely exploration.
    const explorers = Array.from({ length: 12 }, () =>
      candidate({ centroidId: null, authorId: `x${serial}` }),
    );
    expect(assembleSlate([], { size: 12, now: NOW, exploration: explorers })).toHaveLength(12);
  });

  it('does not cap a feed at 40% relevant when somebody has one interest', () => {
    const matched = Array.from({ length: 30 }, () => candidate({ authorId: `m${serial}` }));
    const slate = assembleSlate(matched, {
      size: 10,
      now: NOW,
      exploration: [],
      centroidCount: 1,
    });
    // One interest is allowed the whole feed; the share cap is for sharing out.
    expect(slate).toHaveLength(10);
  });

  it('returns what it can rather than padding when there is not enough', () => {
    const three = Array.from({ length: 3 }, () => candidate({ authorId: `a${serial}` }));
    expect(assembleSlate(three, { size: 50, now: NOW, exploration: [] })).toHaveLength(3);
  });
});
