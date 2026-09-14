import type { Image as ImageDto, SearchResponse, SearchResult } from '@trove/shared';
import type { Image } from '../../domain/entities/Image.js';
import type { ProviderImage } from '../../domain/entities/ProviderImage.js';
import type { ImageSearchResult } from '../../ports/ImageProvider.js';

/** Stored images are always served by our API, never by a provider URL. */
export function imageUrl(imageId: string): string {
  return `/api/images/${imageId}`;
}

export function presentImage(image: Image): ImageDto {
  return {
    id: image.id,
    url: imageUrl(image.id),
    width: image.width,
    height: image.height,
    blurhash: image.blurhash,
    palette: image.palette,
    tags: image.tags,
    credit: { name: image.credit.name, profileUrl: image.credit.url },
    sourceUrl: image.sourceUrl,
    provider: image.provider,
    providerImageId: image.providerImageId,
  };
}

export function presentSearchResult(hit: ProviderImage): SearchResult {
  return {
    provider: hit.provider,
    providerImageId: hit.providerImageId,
    previewUrl: hit.previewUrl,
    previewWidth: hit.previewWidth,
    previewHeight: hit.previewHeight,
    displayUrl: hit.displayUrl,
    width: hit.width,
    height: hit.height,
    tags: hit.tags,
    credit: { name: hit.credit.name, profileUrl: hit.credit.url },
    sourceUrl: hit.sourceUrl,
  };
}

export function presentSearch(result: ImageSearchResult): SearchResponse {
  return {
    results: result.results.map(presentSearchResult),
    page: result.page,
    perPage: result.perPage,
    total: result.total,
  };
}
