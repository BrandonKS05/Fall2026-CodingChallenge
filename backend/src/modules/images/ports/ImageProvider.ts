import type { ImageProviderName } from '../../../domain/entities/Image.js';
import type { ProviderImage } from '../../../domain/entities/ProviderImage.js';

export interface ImageSearchQuery {
  q: string;
  page: number;
  perPage: number;
  orientation: 'all' | 'horizontal' | 'vertical';
  color?: string;
}

export interface ImageSearchResult {
  results: ProviderImage[];
  page: number;
  perPage: number;
  /** Total hits reachable through pagination. */
  total: number;
}

/**
 * Strategy for image discovery. One implementation per provider; the
 * CachedImageProvider decorator wraps any of them.
 */
export interface ImageProvider {
  readonly name: ImageProviderName;
  search(query: ImageSearchQuery): Promise<ImageSearchResult>;
  /** Resolves null when the provider has no such image. */
  getById(providerImageId: string): Promise<ProviderImage | null>;
}
