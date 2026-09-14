import { and, eq } from 'drizzle-orm';
import type { Image, ImageProviderName } from '../../../domain/entities/Image.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type {
  ImagePatch,
  ImageRepository,
  NewImage,
} from '../../../ports/repositories/ImageRepository.js';
import type { Db } from '../client.js';
import { isUniqueViolation } from '../errors.js';
import { images } from '../schema/index.js';

type ImageRow = typeof images.$inferSelect;

/** Exported for the item repository, whose detail rows embed an image. */
export const toImage = (row: ImageRow): Image => ({
  id: row.id,
  provider: row.provider,
  providerImageId: row.providerImageId,
  storageKey: row.storageKey,
  width: row.width,
  height: row.height,
  blurhash: row.blurhash,
  palette: row.palette,
  tags: row.tags,
  credit: { name: row.creditName, url: row.creditUrl },
  sourceUrl: row.sourceUrl,
  createdAt: row.createdAt,
});

const toRow = (input: NewImage): typeof images.$inferInsert => ({
  provider: input.provider,
  providerImageId: input.providerImageId,
  storageKey: input.storageKey,
  width: input.width,
  height: input.height,
  blurhash: input.blurhash,
  palette: input.palette,
  tags: input.tags,
  creditName: input.credit.name,
  creditUrl: input.credit.url,
  sourceUrl: input.sourceUrl,
});

export class DrizzleImageRepository implements ImageRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Image | null> {
    const row = await this.db.query.images.findFirst({ where: eq(images.id, id) });
    return row ? toImage(row) : null;
  }

  async findByProviderId(provider: ImageProviderName, providerImageId: string): Promise<Image | null> {
    const row = await this.db.query.images.findFirst({
      where: and(eq(images.provider, provider), eq(images.providerImageId, providerImageId)),
    });
    return row ? toImage(row) : null;
  }

  async create(input: NewImage): Promise<Image> {
    try {
      const [row] = await this.db.insert(images).values(toRow(input)).returning();
      if (!row) throw new Error('Insert returned no row');
      return toImage(row);
    } catch (error) {
      if (isUniqueViolation(error, 'images_provider_image_idx')) {
        throw new ConflictError('Image was already stored');
      }
      throw error;
    }
  }

  async update(id: string, patch: ImagePatch): Promise<Image> {
    const [row] = await this.db.update(images).set(patch).where(eq(images.id, id)).returning();
    if (!row) throw new NotFoundError('Image', id);
    return toImage(row);
  }
}
