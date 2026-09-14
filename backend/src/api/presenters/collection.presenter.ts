import type {
  Collection as CollectionDto,
  CollectionDetailResponse,
  CollectionListResponse,
} from '@trove/shared';
import type { CollectionSummary } from '../../domain/entities/Collection.js';

export function presentCollection(summary: CollectionSummary): CollectionDto {
  return {
    id: summary.id,
    owner: { id: summary.ownerId, displayName: summary.ownerDisplayName },
    title: summary.title,
    description: summary.description,
    visibility: summary.visibility,
    shareSlug: summary.shareSlug,
    previewImageIds: summary.previewImageIds,
    itemCount: summary.itemCount,
    role: summary.role,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}

export function presentCollectionList(summaries: CollectionSummary[]): CollectionListResponse {
  return { collections: summaries.map(presentCollection) };
}

/** Items are filled in by the items slice; until then a board's detail carries an empty list. */
export function presentCollectionDetail(
  summary: CollectionSummary,
  items: CollectionDetailResponse['items'] = [],
): CollectionDetailResponse {
  return { collection: presentCollection(summary), items };
}
