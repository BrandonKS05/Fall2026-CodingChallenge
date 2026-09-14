import type { Item as ItemDto } from '@trove/shared';
import type { ItemDetail } from '../../domain/entities/CollectionItem.js';
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
