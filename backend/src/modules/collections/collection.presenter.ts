import type {
  Collection as CollectionDto,
  CollectionDetailResponse,
  CollectionListResponse,
  ExploreImagesResponse,
} from '@wumboo/shared';
import type { CollectionSummary, PublicImage } from '../../domain/entities/Collection.js';
import type { ItemDetail } from '../../domain/entities/CollectionItem.js';
import { presentImage } from '../images/image.presenter.js';
import { presentItem } from '../items/item.presenter.js';

export function presentCollection(summary: CollectionSummary): CollectionDto {
  return {
    id: summary.id,
    owner: {
      id: summary.ownerId,
      handle: summary.ownerHandle,
      displayName: summary.ownerDisplayName,
    },
    title: summary.title,
    description: summary.description,
    visibility: summary.visibility,
    shareSlug: summary.shareSlug,
    previewImageIds: summary.previewImageIds,
    itemCount: summary.itemCount,
    role: summary.role,
    likeCount: summary.likeCount,
    likedByViewer: summary.likedByViewer,
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}

export function presentCollectionList(summaries: CollectionSummary[]): CollectionListResponse {
  return { collections: summaries.map(presentCollection) };
}

export function presentExploreImages(rows: PublicImage[]): ExploreImagesResponse {
  return {
    images: rows.map((row) => ({
      image: presentImage(row.image),
      collection: { id: row.collectionId, title: row.collectionTitle },
    })),
  };
}

export function presentCollectionDetail(
  summary: CollectionSummary,
  items: ItemDetail[],
): CollectionDetailResponse {
  return { collection: presentCollection(summary), items: items.map(presentItem) };
}
