import type {
  Collection as CollectionDto,
  CollectionDetailResponse,
  CollectionListResponse,
} from '@trove/shared';
import type { CollectionSummary } from '../../domain/entities/Collection.js';
import type { ItemDetail } from '../../domain/entities/CollectionItem.js';
import { presentItem } from './item.presenter.js';

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

export function presentCollectionDetail(
  summary: CollectionSummary,
  items: ItemDetail[],
): CollectionDetailResponse {
  return { collection: presentCollection(summary), items: items.map(presentItem) };
}
