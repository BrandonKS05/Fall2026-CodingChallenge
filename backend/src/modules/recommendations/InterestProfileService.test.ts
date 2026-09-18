import { describe, expect, it } from 'vitest';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import { InMemoryInterestProfileRepository } from '../../testing/fakes/InMemoryInterestProfileRepository.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { InterestProfileService } from './InterestProfileService.js';
import { normalize, similarity } from './interestMath.js';
import type { CategoryEmbeddingRepository } from './ports/CategoryEmbeddingRepository.js';

const unit = (...values: number[]) => normalize(values);
const USER = 'u1';
const { maxCentroids } = RECOMMENDATIONS.profile;
const { viewDwellMs } = RECOMMENDATIONS.interaction;

/** Two categories that mean nothing alike, so seeding has something to separate. */
const categories = {
  findAll: () => Promise.resolve([]),
  findByCategories: (names: string[]) =>
    Promise.resolve(
      names.map((category, index) => ({
        category: category as never,
        embedding: unit(...Array.from({ length: 4 }, (_, axis) => (axis === index ? 1 : 0.02))),
        sourceText: category,
      })),
    ),
  upsert: () => Promise.resolve(),
} satisfies CategoryEmbeddingRepository;

function build() {
  const profiles = new InMemoryInterestProfileRepository();
  const service = new InterestProfileService({ profiles, categories, logger: silentLogger });
  return { profiles, service };
}

describe('recordInteraction', () => {
  it('starts an interest from the first thing somebody likes', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(1, 0, 0));

    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    const [only] = profiles.centroidsOf(USER);
    expect(profiles.centroidsOf(USER)).toHaveLength(1);
    expect(similarity(only!.centroid, unit(1, 0, 0))).toBeCloseTo(1, 10);
    expect(only!.origin).toBe('interaction');
    expect(only!.weight).toBe(RECOMMENDATIONS.interaction.weights.like);
  });

  it('folds something similar into the interest it belongs to', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(1, 0, 0));
    profiles.setItemVector('i2', unit(1, 0.2, 0));
    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    await service.recordInteraction({ userId: USER, itemId: 'i2', type: 'save' });

    expect(profiles.centroidsOf(USER)).toHaveLength(1);
    const [only] = profiles.centroidsOf(USER);
    // It leaned towards the second picture without abandoning the first.
    expect(similarity(only!.centroid, unit(1, 0.2, 0))).toBeGreaterThan(
      similarity(unit(1, 0, 0), unit(1, 0.2, 0)),
    );
    expect(only!.weight).toBeCloseTo(
      RECOMMENDATIONS.interaction.weights.like + RECOMMENDATIONS.interaction.weights.save,
      10,
    );
  });

  it('starts a second interest for something unlike the first', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(1, 0, 0));
    profiles.setItemVector('i2', unit(0, 1, 0));
    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    await service.recordInteraction({ userId: USER, itemId: 'i2', type: 'like' });

    expect(profiles.centroidsOf(USER)).toHaveLength(2);
  });

  it('drops the weakest interest once there is no room for another', async () => {
    const { profiles, service } = build();
    // One weak interest, then enough strong ones to fill the cap.
    profiles.setItemVector('weak', spread(0));
    await service.recordInteraction({ userId: USER, itemId: 'weak', type: 'view', dwellMs: 9_000 });
    for (let index = 1; index < maxCentroids; index += 1) {
      profiles.setItemVector(`i${index}`, spread(index));
      await service.recordInteraction({ userId: USER, itemId: `i${index}`, type: 'share' });
    }
    expect(profiles.centroidsOf(USER)).toHaveLength(maxCentroids);

    profiles.setItemVector('newcomer', spread(maxCentroids));
    await service.recordInteraction({ userId: USER, itemId: 'newcomer', type: 'like' });

    expect(profiles.centroidsOf(USER)).toHaveLength(maxCentroids);
    // The one nobody did more than glance at is the one that went.
    const weakest = RECOMMENDATIONS.interaction.weights.view;
    expect(profiles.centroidsOf(USER).some((entry) => entry.weight === weakest)).toBe(false);
  });

  it('moves an interest away from something hidden, and never invents one', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('liked', unit(1, 1, 0));
    profiles.setItemVector('hated', unit(1, 0, 0));
    await service.recordInteraction({ userId: USER, itemId: 'liked', type: 'like' });
    const before = profiles.centroidsOf(USER)[0]!.centroid;

    await service.recordInteraction({ userId: USER, itemId: 'hated', type: 'hide' });

    const after = profiles.centroidsOf(USER)[0]!;
    expect(profiles.centroidsOf(USER)).toHaveLength(1);
    expect(similarity(after.centroid, unit(1, 0, 0))).toBeLessThan(
      similarity(before, unit(1, 0, 0)),
    );
    expect(after.weight).toBeLessThan(RECOMMENDATIONS.interaction.weights.like);
  });

  it('learns nothing from a hide when there is no interest to move', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('hated', unit(1, 0, 0));

    await service.recordInteraction({ userId: USER, itemId: 'hated', type: 'hide' });

    expect(profiles.centroidsOf(USER)).toHaveLength(0);
    expect(profiles.interactions).toHaveLength(1);
  });

  it('ignores a glance, and counts a proper look', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(1, 0, 0));

    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'view', dwellMs: 500 });
    expect(profiles.interactions).toHaveLength(0);
    expect(profiles.centroidsOf(USER)).toHaveLength(0);

    await service.recordInteraction({
      userId: USER,
      itemId: 'i1',
      type: 'view',
      dwellMs: viewDwellMs + 1,
    });
    expect(profiles.centroidsOf(USER)).toHaveLength(1);
  });

  it('counts liking the same picture twice once', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(1, 0, 0));

    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });
    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    expect(profiles.centroidsOf(USER)[0]?.weight).toBe(RECOMMENDATIONS.interaction.weights.like);
  });

  it('writes down an act on a picture that has no vector yet, and learns later', async () => {
    const { profiles, service } = build();

    await service.recordInteraction({ userId: USER, itemId: 'unembedded', type: 'like' });

    expect(profiles.interactions).toHaveLength(1);
    expect(profiles.centroidsOf(USER)).toHaveLength(0);
  });

  it('treats a category somebody acted on as an interest they earned', async () => {
    const { profiles, service } = build();
    await service.seedFromCategories(USER, ['nature' as never]);
    const seeded = profiles.centroidsOf(USER)[0]!;
    expect(seeded.origin).toBe('category-seed');

    profiles.setItemVector('i1', seeded.centroid);
    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    expect(profiles.centroidsOf(USER)[0]?.origin).toBe('interaction');
  });
});

describe('seedFromCategories', () => {
  it('spends only a couple of interests on what somebody ticked', async () => {
    const { profiles, service } = build();

    await service.seedFromCategories(USER, ['a', 'b', 'c', 'd'] as never);

    const seeded = profiles.centroidsOf(USER);
    expect(seeded.length).toBeLessThanOrEqual(RECOMMENDATIONS.profile.maxSeedCentroids);
    expect(seeded.every((entry) => entry.origin === 'category-seed')).toBe(true);
    // Declared, not earned: no evidence stands behind them yet.
    expect(seeded.every((entry) => entry.weight === 0)).toBe(true);
  });

  it('leaves earned interests alone when the picks are seeded again', async () => {
    const { profiles, service } = build();
    profiles.setItemVector('i1', unit(0, 0, 0, 1));
    await service.recordInteraction({ userId: USER, itemId: 'i1', type: 'like' });

    await service.seedFromCategories(USER, ['a', 'b'] as never);

    const earned = profiles.centroidsOf(USER).filter((entry) => entry.origin === 'interaction');
    expect(earned).toHaveLength(1);
  });

  it('does nothing when nobody ticked anything', async () => {
    const { profiles, service } = build();
    await service.seedFromCategories(USER, []);
    expect(profiles.centroidsOf(USER)).toHaveLength(0);
  });
});

/** A direction that is unlike every other one this helper makes. */
function spread(index: number): number[] {
  const values = Array.from({ length: maxCentroids + 2 }, () => 0);
  values[index] = 1;
  return unit(...values);
}
