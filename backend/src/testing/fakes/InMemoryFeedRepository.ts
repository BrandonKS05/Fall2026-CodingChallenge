import { randomUUID } from 'node:crypto';
import type { Candidate } from '../../domain/entities/Recommendation.js';
import type {
  FeedItem,
  FeedRepository,
} from '../../modules/recommendations/ports/FeedRepository.js';

/**
 * Slates and impressions in two Maps. Candidate generation belongs to the
 * database, so a test that wants candidates puts them here directly.
 */
export class InMemoryFeedRepository implements FeedRepository {
  readonly nearest: Candidate[] = [];
  readonly popular: Candidate[] = [];
  readonly items = new Map<string, FeedItem>();
  private readonly slates = new Map<string, string[]>();
  private readonly impressions = new Map<string, Set<string>>();

  /**
   * Public pictures nobody has seen, each by a different person, most engaging
   * first — and a matching item for each, complete enough for the presenter.
   */
  seed(count: number, into: 'popular' | 'nearest' = 'popular'): void {
    for (let index = 0; index < count; index += 1) {
      const itemId = `1111${String(index).padStart(4, '0')}-1111-4111-8111-111111111111`;
      this[into].push({
        itemId,
        imageId: `image-${index}`,
        authorId: `author-${index}`,
        createdAt: new Date(),
        similarity: 1 - index / (count * 2),
        engagement: count - index,
        centroidId: null,
      });
      this.items.set(itemId, feedItem(itemId, index));
    }
  }

  findNearest(_userId: string, _vector: number[], limit: number): Promise<Candidate[]> {
    return Promise.resolve(this.nearest.slice(0, limit));
  }

  findPopular(_userId: string, limit: number): Promise<Candidate[]> {
    return Promise.resolve(this.popular.slice(0, limit));
  }

  createSlate(_userId: string, itemIds: string[]): Promise<string> {
    const id = randomUUID();
    this.slates.set(id, itemIds);
    return Promise.resolve(id);
  }

  findSlate(id: string): Promise<string[] | null> {
    return Promise.resolve(this.slates.get(id) ?? null);
  }

  findItems(itemIds: string[]): Promise<FeedItem[]> {
    return Promise.resolve(
      itemIds.map((id) => this.items.get(id)).filter((item) => item !== undefined),
    );
  }

  recordImpressions(userId: string, itemIds: string[]): Promise<void> {
    const seen = this.impressions.get(userId) ?? new Set<string>();
    for (const id of itemIds) seen.add(id);
    this.impressions.set(userId, seen);
    return Promise.resolve();
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}

/** The whole shape, because the presenter reads all of it. */
function feedItem(itemId: string, index: number): FeedItem {
  const now = new Date();
  return {
    id: itemId,
    collectionId: `2222${String(index).padStart(4, '0')}-2222-4222-8222-222222222222`,
    collectionTitle: `Board ${index}`,
    imageId: `3333${String(index).padStart(4, '0')}-3333-4333-8333-333333333333`,
    addedById: `4444${String(index).padStart(4, '0')}-4444-4444-8444-444444444444`,
    caption: `Picture ${index}`,
    tags: ['tag'],
    position: index,
    createdAt: now,
    updatedAt: now,
    addedBy: {
      id: `4444${String(index).padStart(4, '0')}-4444-4444-8444-444444444444`,
      handle: `person${index}`,
      displayName: `Person ${index}`,
    },
    image: {
      id: `3333${String(index).padStart(4, '0')}-3333-4333-8333-333333333333`,
      provider: 'pixabay',
      providerImageId: String(index),
      storageKey: `key-${index}`,
      width: 1600,
      height: 1200,
      blurhash: null,
      palette: [],
      tags: ['tag'],
      credit: { name: 'photographer', url: null },
      sourceUrl: null,
      createdAt: now,
    },
  };
}
