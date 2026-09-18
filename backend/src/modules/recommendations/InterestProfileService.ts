/**
 * What somebody is interested in, kept up to date by what they do.
 *
 * A profile is a handful of centroids rather than one averaged vector, because
 * averaging brutalist architecture and tide pools lands on neither. Each act
 * finds the interest it belongs to and nudges it; an act that belongs to none
 * of them starts a new one, and if there is no room the weakest interest goes.
 *
 * The one asymmetry worth knowing: a hide moves an interest away from what was
 * hidden, but never creates one. Disliking something says nothing about what
 * somebody would like instead.
 */
import type { SearchCategory } from '@wumboo/shared';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import type { InteractionType } from '../../domain/entities/Interaction.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import {
  blendAway,
  blendToward,
  nearestCentroid,
  seedCentroids,
  stepSize,
  weakestCentroid,
} from './interestMath.js';
import type { CategoryEmbeddingRepository } from './ports/CategoryEmbeddingRepository.js';
import type {
  InterestProfileRepository,
  StoredCentroid,
} from './ports/InterestProfileRepository.js';

const { weights, viewDwellMs } = RECOMMENDATIONS.interaction;
const { alpha, maxCentroids, maxSeedCentroids, mergeThreshold, stalenessDays } =
  RECOMMENDATIONS.profile;

export interface RecordInteractionInput {
  userId: string;
  itemId: string;
  type: InteractionType;
  /** How long the picture was on screen. Only a view is judged by it. */
  dwellMs?: number | undefined;
}

export interface InterestProfileDeps {
  profiles: InterestProfileRepository;
  categories: CategoryEmbeddingRepository;
  users: UserRepository;
  logger: Logger;
  now?: () => Date;
}

export class InterestProfileService {
  constructor(private readonly deps: InterestProfileDeps) {}

  /**
   * Saving a picture to a board is the strongest thing anybody does in this
   * app, and it already has an event. Listening for it means the profile keeps
   * up with ordinary use without the interface having to report anything.
   */
  listen(events: EventBus): () => void {
    return events.subscribe('item.added', (event) => {
      void this.recordInteraction({
        userId: event.payload.actorId,
        itemId: event.payload.itemId,
        type: 'save',
      });
    });
  }

  /**
   * One act, folded into the profile. Recording it and learning from it are
   * separate: an act on a picture that has not been embedded yet is still
   * written down, so the profile can be rebuilt from history later.
   */
  async recordInteraction(input: RecordInteractionInput): Promise<void> {
    const weight = weights[input.type];
    // Scrolling past is not interest. Anything below the dwell is not recorded
    // at all, so it cannot be counted later either.
    if (input.type === 'view' && (input.dwellMs ?? 0) < viewDwellMs) return;

    const fresh = await this.deps.profiles.recordInteraction({
      userId: input.userId,
      itemId: input.itemId,
      type: input.type,
      weight,
      dwellMs: input.dwellMs ?? null,
    });
    // Clicking like twice is one like.
    if (!fresh) return;

    await this.applyToProfile(input.userId, input.itemId, weight);
  }

  /** The learning half, shared by an act as it happens and one caught up with later. */
  private async applyToProfile(userId: string, itemId: string, weight: number): Promise<void> {
    const vector = await this.deps.profiles.findItemVector(itemId);
    if (!vector) {
      this.deps.logger.debug({ itemId }, 'Interaction recorded before the picture was embedded');
      return;
    }

    const centroids = await this.deps.profiles.findCentroids(userId);
    const nearest = nearestCentroid(centroids, vector);
    const step = stepSize(alpha, weight);

    if (weight < 0) {
      // Nothing to push away from: a dislike about an interest nobody holds.
      if (!nearest || nearest.similarity <= 0) return;
      const target = centroids[nearest.index]!;
      await this.deps.profiles.updateCentroid(target.id, {
        centroid: blendAway(target.centroid, vector, step),
        weight: target.weight + weight,
        origin: target.origin,
      });
      return;
    }

    if (nearest && nearest.similarity > mergeThreshold) {
      const target = centroids[nearest.index]!;
      await this.deps.profiles.updateCentroid(target.id, {
        centroid: blendToward(target.centroid, vector, step),
        weight: target.weight + weight,
        // A category somebody ticked, that they then acted on, has been earned.
        origin: 'interaction',
      });
      return;
    }

    await this.spawn(userId, centroids, vector, weight);
  }

  /**
   * A picture saved before it was embedded taught the profile nothing at the
   * time, because there was no vector to learn from. The embedding worker calls
   * this the moment there is one, and the acts already on record are folded in
   * as if they had landed a second later. This is why interactions are written
   * down even when they cannot be used yet.
   */
  async foldInPending(itemIds: string[]): Promise<void> {
    const pending = await this.deps.profiles.findInteractionsForItems(itemIds);
    for (const entry of pending) {
      await this.applyToProfile(entry.userId, entry.itemId, entry.weight);
    }
  }

  /**
   * The one-time step a new account is shown before anything else. Whatever
   * they picked seeds the profile; picking nothing is a real answer. Either
   * way the step is stamped as done, so it is never asked again.
   */
  async completeOnboarding(userId: string, categories: SearchCategory[]): Promise<void> {
    await this.seedFromCategories(userId, categories);
    await this.deps.users.markOnboarded(userId);
  }

  /**
   * The first thing the feed knows about anybody: the categories they ticked,
   * folded into a couple of starting points rather than one per tick, so the
   * interests they go on to earn have somewhere to live.
   */
  async seedFromCategories(userId: string, categories: SearchCategory[]): Promise<void> {
    if (categories.length === 0) return;
    const rows = await this.deps.categories.findByCategories(categories);
    if (rows.length === 0) {
      this.deps.logger.warn(
        { userId, categories },
        'No category embeddings to seed from: run embeddings:categories',
      );
      return;
    }

    const seeds = seedCentroids(
      rows.map((row) => row.embedding),
      Math.min(maxSeedCentroids, maxCentroids),
    );
    await this.deps.profiles.replaceSeedCentroids(
      userId,
      seeds.map((centroid) => ({ centroid, weight: 0, origin: 'category-seed' as const })),
    );
  }

  /** A new interest, making room for it if the cap has been reached. */
  private async spawn(
    userId: string,
    centroids: StoredCentroid[],
    vector: number[],
    weight: number,
  ): Promise<void> {
    if (centroids.length >= maxCentroids) {
      const doomed = centroids[weakestCentroid(centroids, this.now(), stalenessDays)];
      if (doomed) await this.deps.profiles.deleteCentroid(doomed.id);
    }
    await this.deps.profiles.insertCentroid(userId, {
      centroid: vector,
      weight,
      origin: 'interaction',
    });
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}
