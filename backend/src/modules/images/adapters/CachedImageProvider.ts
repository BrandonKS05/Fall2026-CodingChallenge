import { LRUCache } from 'lru-cache';
import type { ImageProviderName } from '../../../domain/entities/Image.js';
import type { ProviderImage } from '../../../domain/entities/ProviderImage.js';
import type {
  ImageProvider,
  ImageSearchQuery,
  ImageSearchResult,
} from '../ports/ImageProvider.js';

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decorator: adds a 24-hour cache in front of any ImageProvider. Pixabay's
 * terms require caching requests for 24 hours, and it keeps repeated searches
 * instant. Identical concurrent searches share one upstream request.
 */
export class CachedImageProvider implements ImageProvider {
  readonly name: ImageProviderName;
  private readonly searches: LRUCache<string, ImageSearchResult>;
  private readonly images: LRUCache<string, ProviderImage>;
  private readonly inFlight = new Map<string, Promise<ImageSearchResult>>();

  constructor(
    private readonly inner: ImageProvider,
    { ttlMs = ONE_DAY_MS, maxEntries = 500 }: CacheOptions = {},
  ) {
    this.name = inner.name;
    this.searches = new LRUCache({ max: maxEntries, ttl: ttlMs });
    this.images = new LRUCache({ max: maxEntries * 4, ttl: ttlMs });
  }

  search(query: ImageSearchQuery): Promise<ImageSearchResult> {
    const key = searchKey(query);
    const cached = this.searches.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.inner
      .search(query)
      .then((result) => {
        this.searches.set(key, result);
        return result;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  async getById(providerImageId: string): Promise<ProviderImage | null> {
    const cached = this.images.get(providerImageId);
    if (cached) return cached;
    const image = await this.inner.getById(providerImageId);
    if (image) this.images.set(providerImageId, image);
    return image;
  }
}

function searchKey(query: ImageSearchQuery): string {
  return JSON.stringify([
    query.q.trim().toLowerCase(),
    query.page,
    query.perPage,
    query.orientation,
    query.color ?? '',
  ]);
}
