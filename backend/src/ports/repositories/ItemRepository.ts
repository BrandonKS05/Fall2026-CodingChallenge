import type { CollectionItem, ItemDetail } from '../../domain/entities/CollectionItem.js';

export interface NewItem {
  collectionId: string;
  imageId: string;
  addedById: string;
  caption: string;
  tags: string[];
  position: number;
}

export type ItemPatch = Partial<
  Pick<CollectionItem, 'caption' | 'tags' | 'position' | 'collectionId'>
>;

export interface ItemRepository {
  findById(id: string): Promise<CollectionItem | null>;
  findDetail(id: string): Promise<ItemDetail | null>;
  /** Items with their image and adder, ordered by position then newest first. */
  listByCollection(collectionId: string): Promise<ItemDetail[]>;
  /** Throws ConflictError when the image is already in the collection. */
  create(input: NewItem): Promise<CollectionItem>;
  /** Throws NotFoundError when the id does not exist. */
  update(id: string, patch: ItemPatch): Promise<CollectionItem>;
  delete(id: string): Promise<void>;
  /** Position for appending: one past the current maximum, or 0 when empty. */
  nextPosition(collectionId: string): Promise<number>;
}
