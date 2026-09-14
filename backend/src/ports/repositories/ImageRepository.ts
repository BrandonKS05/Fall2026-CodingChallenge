import type { Image, ImageProviderName } from '../../domain/entities/Image.js';

export type NewImage = Omit<Image, 'id' | 'createdAt'>;

/** Fields computed asynchronously after the download. */
export type ImagePatch = Partial<Pick<Image, 'blurhash' | 'palette'>>;

export interface ImageRepository {
  findById(id: string): Promise<Image | null>;
  /** Lets a save reuse an image that was already downloaded for another board. */
  findByProviderId(provider: ImageProviderName, providerImageId: string): Promise<Image | null>;
  create(input: NewImage): Promise<Image>;
  /** Throws NotFoundError when the id does not exist. */
  update(id: string, patch: ImagePatch): Promise<Image>;
}
