import type { Image } from './Image.js';

/** An image placed in a collection, with the user's own caption and tags. */
export interface CollectionItem {
  id: string;
  collectionId: string;
  imageId: string;
  addedById: string;
  caption: string;
  tags: string[];
  /** Ordering within the collection; lower comes first. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Read model for rendering a board: the item with its image and who added it. */
export interface ItemDetail extends CollectionItem {
  image: Image;
  addedBy: { id: string; displayName: string };
}
