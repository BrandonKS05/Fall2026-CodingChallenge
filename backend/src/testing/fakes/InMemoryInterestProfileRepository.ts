import type {
  CentroidPatch,
  InteractionEntry,
  InterestProfileRepository,
  NewCentroid,
  StoredCentroid,
} from '../../modules/recommendations/ports/InterestProfileRepository.js';

/** Centroids, interactions and item vectors in three Maps, with the same rules. */
export class InMemoryInterestProfileRepository implements InterestProfileRepository {
  private readonly centroids = new Map<string, StoredCentroid[]>();
  private readonly vectors = new Map<string, number[]>();
  /** The deliberate acts already on record, keyed the way the unique index is. */
  private readonly acts = new Set<string>();
  readonly interactions: InteractionEntry[] = [];
  private next = 0;

  setItemVector(itemId: string, vector: number[]): void {
    this.vectors.set(itemId, vector);
  }

  centroidsOf(userId: string): StoredCentroid[] {
    return this.centroids.get(userId) ?? [];
  }

  findCentroids(userId: string): Promise<StoredCentroid[]> {
    return Promise.resolve(this.centroidsOf(userId).map((entry) => ({ ...entry })));
  }

  insertCentroid(userId: string, centroid: NewCentroid): Promise<void> {
    const held = this.centroids.get(userId) ?? [];
    held.push({ id: `c${this.next++}`, lastReinforcedAt: new Date(), ...centroid });
    this.centroids.set(userId, held);
    return Promise.resolve();
  }

  replaceSeedCentroids(userId: string, centroids: NewCentroid[]): Promise<void> {
    const kept = this.centroidsOf(userId).filter((entry) => entry.origin !== 'category-seed');
    this.centroids.set(userId, kept);
    for (const centroid of centroids) void this.insertCentroid(userId, centroid);
    return Promise.resolve();
  }

  updateCentroid(id: string, patch: CentroidPatch): Promise<void> {
    for (const held of this.centroids.values()) {
      const target = held.find((entry) => entry.id === id);
      if (target) Object.assign(target, patch, { lastReinforcedAt: new Date() });
    }
    return Promise.resolve();
  }

  deleteCentroid(id: string): Promise<void> {
    for (const [userId, held] of this.centroids) {
      this.centroids.set(
        userId,
        held.filter((entry) => entry.id !== id),
      );
    }
    return Promise.resolve();
  }

  recordInteraction(entry: InteractionEntry): Promise<boolean> {
    this.interactions.push(entry);
    if (entry.type === 'view') return Promise.resolve(true);
    const key = `${entry.userId}:${entry.itemId}:${entry.type}`;
    if (this.acts.has(key)) return Promise.resolve(false);
    this.acts.add(key);
    return Promise.resolve(true);
  }

  findInteractionsForItems(itemIds: string[]): Promise<InteractionEntry[]> {
    return Promise.resolve(this.interactions.filter((entry) => itemIds.includes(entry.itemId)));
  }

  findItemVector(itemId: string): Promise<number[] | null> {
    return Promise.resolve(this.vectors.get(itemId) ?? null);
  }
}
