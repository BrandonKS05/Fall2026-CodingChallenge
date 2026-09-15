import type { Image, ImageProviderName } from '../../../domain/entities/Image.js';

export type NewImage = Omit<Image, 'id' | 'createdAt'>;

/**
 * Fields computed asynchronously after the download, plus the storage key,
 * which moves when a lost file is restored under a different file type.
 */
export type ImagePatch = Partial<Pick<Image, 'blurhash' | 'palette' | 'storageKey'>>;

export interface ImageRepository {
  findById(id: string): Promise<Image | null>;
  /** Lets a save reuse an image that was already downloaded for another board. */
  findByProviderId(provider: ImageProviderName, providerImageId: string): Promise<Image | null>;
  /** The stored images for a list of provider ids, in whatever order the database returns. */
  listByProviderIds(provider: ImageProviderName, providerImageIds: string[]): Promise<Image[]>;
  create(input: NewImage): Promise<Image>;
  /** Throws NotFoundError when the id does not exist. */
  update(id: string, patch: ImagePatch): Promise<Image>;
}
