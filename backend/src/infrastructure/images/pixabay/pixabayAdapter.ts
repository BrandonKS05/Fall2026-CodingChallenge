/**
 * Adapter: translates Pixabay's response shape into the domain's ProviderImage.
 * Parsing with zod at the boundary means an API change fails loudly here
 * instead of as undefined values deep in the app.
 */
import { z } from 'zod';
import type { ProviderImage } from '../../../domain/entities/ProviderImage.js';

const pixabayHitSchema = z.object({
  id: z.number(),
  pageURL: z.string(),
  tags: z.string(),
  previewURL: z.string(),
  previewWidth: z.number(),
  previewHeight: z.number(),
  webformatURL: z.string(),
  largeImageURL: z.string(),
  imageWidth: z.number(),
  imageHeight: z.number(),
  user: z.string(),
  user_id: z.number(),
});

export const pixabayResponseSchema = z.object({
  total: z.number(),
  totalHits: z.number(),
  hits: z.array(pixabayHitSchema),
});

export type PixabayHit = z.infer<typeof pixabayHitSchema>;
export type PixabayResponse = z.infer<typeof pixabayResponseSchema>;

export function toProviderImage(hit: PixabayHit): ProviderImage {
  return {
    provider: 'pixabay',
    providerImageId: String(hit.id),
    previewUrl: hit.previewURL,
    previewWidth: hit.previewWidth,
    previewHeight: hit.previewHeight,
    displayUrl: hit.webformatURL,
    downloadUrl: hit.largeImageURL,
    width: hit.imageWidth,
    height: hit.imageHeight,
    tags: hit.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    credit: {
      name: hit.user,
      url: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`,
    },
    sourceUrl: hit.pageURL,
  };
}
