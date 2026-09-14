import { randomUUID } from 'node:crypto';
import type { Image, ImageProviderName } from '../../domain/entities/Image.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type { ImagePatch, ImageRepository, NewImage } from '../../ports/repositories/ImageRepository.js';

export class InMemoryImageRepository implements ImageRepository {
  readonly rows = new Map<string, Image>();

  async findById(id: string): Promise<Image | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProviderId(provider: ImageProviderName, providerImageId: string): Promise<Image | null> {
    return (
      [...this.rows.values()].find(
        (image) => image.provider === provider && image.providerImageId === providerImageId,
      ) ?? null
    );
  }

  async create(input: NewImage): Promise<Image> {
    if (await this.findByProviderId(input.provider, input.providerImageId)) {
      throw new ConflictError('Image was already stored');
    }
    const image: Image = { id: randomUUID(), ...input, createdAt: new Date() };
    this.rows.set(image.id, image);
    return image;
  }

  async update(id: string, patch: ImagePatch): Promise<Image> {
    const existing = this.rows.get(id);
    if (!existing) throw new NotFoundError('Image', id);
    const updated = { ...existing, ...patch };
    this.rows.set(id, updated);
    return updated;
  }
}
