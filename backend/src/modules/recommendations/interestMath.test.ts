import { describe, expect, it } from 'vitest';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import {
  blendAway,
  blendToward,
  keepScore,
  nearestCentroid,
  normalize,
  seedCentroids,
  similarity,
  stepSize,
  weakestCentroid,
  type Centroid,
} from './interestMath.js';

const unit = (...values: number[]) => normalize(values);
const NOW = new Date('2026-09-17T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const centroid = (overrides: Partial<Centroid> = {}): Centroid => ({
  centroid: unit(1, 0, 0),
  weight: 1,
  origin: 'interaction',
  lastReinforcedAt: NOW,
  ...overrides,
});

describe('similarity', () => {
  it('is one for the same direction, zero at right angles, minus one opposed', () => {
    expect(similarity(unit(1, 0, 0), unit(1, 0, 0))).toBeCloseTo(1, 10);
    expect(similarity(unit(1, 0, 0), unit(0, 1, 0))).toBeCloseTo(0, 10);
    expect(similarity(unit(1, 0, 0), unit(-1, 0, 0))).toBeCloseTo(-1, 10);
  });
});

describe('stepSize', () => {
  it('lets a save move an interest further than a view', () => {
    const { alpha } = RECOMMENDATIONS.profile;
    const { save, view } = RECOMMENDATIONS.interaction.weights;
    expect(stepSize(alpha, save)).toBeGreaterThan(stepSize(alpha, view));
  });

  it('never lets one act replace an interest outright', () => {
    expect(stepSize(0.15, 1000)).toBeLessThan(1);
    // A hide moves by as much as a like, in the other direction.
    expect(stepSize(0.15, -1)).toBe(stepSize(0.15, 1));
  });
});

describe('blendToward', () => {
  it('slides the interest at the picture and stays on the unit sphere', () => {
    const before = unit(1, 0, 0);
    const after = blendToward(before, unit(0, 1, 0), 0.25);

    expect(Math.hypot(...after)).toBeCloseTo(1, 10);
    expect(similarity(after, unit(0, 1, 0))).toBeGreaterThan(similarity(before, unit(0, 1, 0)));
    // A quarter step is a lean, not a jump: it is still mostly where it was.
    expect(similarity(after, before)).toBeGreaterThan(0.9);
  });

  it('leaves an interest alone when the picture is already it', () => {
    const before = unit(1, 0, 0);
    expect(similarity(blendToward(before, before, 0.3), before)).toBeCloseTo(1, 10);
  });
});

describe('blendAway', () => {
  it('moves the interest off the picture that was hidden', () => {
    const before = unit(1, 1, 0);
    const disliked = unit(1, 0, 0);
    const after = blendAway(before, disliked, 0.25);

    expect(Math.hypot(...after)).toBeCloseTo(1, 10);
    expect(similarity(after, disliked)).toBeLessThan(similarity(before, disliked));
  });
});

describe('nearestCentroid', () => {
  it('finds the interest a picture belongs to', () => {
    const centroids = [
      centroid({ centroid: unit(1, 0, 0) }),
      centroid({ centroid: unit(0, 1, 0) }),
    ];
    expect(nearestCentroid(centroids, unit(0.1, 1, 0))).toMatchObject({ index: 1 });
  });

  it('has nothing to say about someone with no interests yet', () => {
    expect(nearestCentroid([], unit(1, 0, 0))).toBeNull();
  });
});

describe('keepScore and weakestCentroid', () => {
  it('values evidence, and fades it with silence', () => {
    const fresh = centroid({ weight: 2, lastReinforcedAt: NOW });
    const stale = centroid({ weight: 2, lastReinforcedAt: daysAgo(60) });
    const { stalenessDays } = RECOMMENDATIONS.profile;

    expect(keepScore(fresh, NOW, stalenessDays)).toBeGreaterThan(
      keepScore(stale, NOW, stalenessDays),
    );
  });

  it('drops a category somebody ticked before an interest they earned', () => {
    const seed = centroid({ origin: 'category-seed', weight: 1 });
    const earned = centroid({ origin: 'interaction', weight: 1 });
    const { stalenessDays } = RECOMMENDATIONS.profile;

    expect(weakestCentroid([earned, seed], NOW, stalenessDays)).toBe(1);
    expect(keepScore(seed, NOW, stalenessDays)).toBeLessThan(keepScore(earned, NOW, stalenessDays));
  });

  it('drops the one with the least behind it when they are the same kind', () => {
    const centroids = [
      centroid({ weight: 5 }),
      centroid({ weight: 0.2 }),
      centroid({ weight: 3, lastReinforcedAt: daysAgo(10) }),
    ];
    expect(weakestCentroid(centroids, NOW, RECOMMENDATIONS.profile.stalenessDays)).toBe(1);
  });

  it('will drop an interest that has only ever been pushed away from', () => {
    const disliked = centroid({ weight: -4 });
    const barely = centroid({ weight: 0.1 });
    expect(weakestCentroid([barely, disliked], NOW, 30)).toBe(1);
  });
});

describe('seedCentroids', () => {
  it('keeps every pick when there is room for all of them', () => {
    const picks = [unit(1, 0, 0), unit(0, 1, 0)];
    expect(seedCentroids(picks, 3)).toHaveLength(2);
  });

  it('folds picks that mean the same thing into one interest', () => {
    // Three outdoors-ish picks and one that is nothing like them.
    const outdoors = [unit(1, 0.05, 0), unit(1, 0.1, 0), unit(0.95, 0, 0.05)];
    const other = unit(0, 0, 1);
    const seeds = seedCentroids([...outdoors, other], 2);

    expect(seeds).toHaveLength(2);
    // One seed stands for the three, the other for the odd one out.
    const forOther = seeds.find((seed) => similarity(seed, other) > 0.9);
    const forOutdoors = seeds.find((seed) => similarity(seed, outdoors[0]!) > 0.9);
    expect(forOther).toBeDefined();
    expect(forOutdoors).toBeDefined();
  });

  it('gives every seed unit length, so the index can rank against them', () => {
    const seeds = seedCentroids([unit(1, 1, 0), unit(1, 0, 0), unit(0, 0, 1)], 2);
    for (const seed of seeds) expect(Math.hypot(...seed)).toBeCloseTo(1, 10);
  });

  it('has nothing to seed from nothing', () => {
    expect(seedCentroids([], 3)).toEqual([]);
  });
});
