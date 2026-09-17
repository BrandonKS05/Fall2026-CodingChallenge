import type {
  Item as ItemDto,
  SavedItem as SavedItemDto,
  SavedItemsResponse,
} from '@wumboo/shared';
import type { ItemDetail, SavedItem } from '../../domain/entities/CollectionItem.js';
import { presentImage } from '../images/image.presenter.js';

export function presentItem(detail: ItemDetail): ItemDto {
  return {
    id: detail.id,
    collectionId: detail.collectionId,
    image: presentImage(detail.image),
    caption: detail.caption,
    tags: detail.tags,
    position: detail.position,
    addedBy: detail.addedBy,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
  };
}

function presentSavedItem(saved: SavedItem): SavedItemDto {
  return {
    ...presentItem(saved),
    collection: { id: saved.collectionId, title: saved.collectionTitle },
  };
}

export function presentSavedItems(saved: SavedItem[]): SavedItemsResponse {
  return { items: saved.map(presentSavedItem) };
}
