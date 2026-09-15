/**
 * Image discovery contract. Results are provider-agnostic: the backend adapts
 * each provider's response into this shape, so adding Unsplash later changes
 * nothing on the frontend.
 */
import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

/** Extension point: add a provider here and implement its ImageProvider strategy on the backend. */
export const imageProviderSchema = z.enum(['pixabay']);
export type ImageProvider = z.infer<typeof imageProviderSchema>;

export const imageOrientationSchema = z.enum(['all', 'horizontal', 'vertical']);

export const searchColorSchema = z.enum([
  'grayscale',
  'transparent',
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'blue',
  'lilac',
  'pink',
  'white',
  'gray',
  'black',
  'brown',
]);

export type SearchColor = z.infer<typeof searchColorSchema>;

/** What Pixabay indexes each named colour as, so a hex can be matched to one. */
const COLOR_SWATCHES: Record<Exclude<SearchColor, 'transparent' | 'grayscale'>, string> = {
  red: '#e02020',
  orange: '#f07818',
  yellow: '#f0c020',
  green: '#3cb043',
  turquoise: '#18c0b0',
  blue: '#2060e0',
  lilac: '#a878e8',
  pink: '#e858a0',
  white: '#ffffff',
  gray: '#909090',
  black: '#101010',
  brown: '#8a5a2b',
};

/**
 * The nearest colour Pixabay knows about. The provider indexes by name, not by
 * value, so a colour picked from a wheel has to be answered with the closest
 * word rather than the exact shade.
 */
export function nearestSearchColor(hex: string): SearchColor {
  const target = rgbOf(hex);
  let best: SearchColor = 'gray';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, swatch] of Object.entries(COLOR_SWATCHES)) {
    const candidate = rgbOf(swatch);
    const distance =
      (target[0] - candidate[0]) ** 2 +
      (target[1] - candidate[1]) ** 2 +
      (target[2] - candidate[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name as SearchColor;
    }
  }
  return best;
}

function rgbOf(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

/** Pixabay's own categories, in its own order. */
export const searchCategorySchema = z.enum([
  'backgrounds',
  'fashion',
  'nature',
  'science',
  'education',
  'feelings',
  'health',
  'people',
  'religion',
  'places',
  'animals',
  'industry',
  'computer',
  'food',
  'sports',
  'transportation',
  'travel',
  'buildings',
  'business',
  'music',
]);
export type SearchCategory = z.infer<typeof searchCategorySchema>;

export const imageTypeSchema = z.enum(['all', 'photo', 'illustration', 'vector']);
export type ImageType = z.infer<typeof imageTypeSchema>;

export const searchOrderSchema = z.enum(['popular', 'latest']);
export type SearchOrder = z.infer<typeof searchOrderSchema>;

/**
 * Whether there is enough here to search with. Words are the usual answer, but
 * a category or a colour narrows the library on their own — and a colour and a
 * shape is exactly what an attached picture gives us, with no words at all.
 */
export function isSearchable(query: {
  q: string;
  category?: SearchCategory | undefined;
  color?: SearchColor | undefined;
  colorHex?: string | undefined;
}): boolean {
  return (
    query.q.trim() !== '' ||
    query.category !== undefined ||
    query.color !== undefined ||
    query.colorHex !== undefined
  );
}

export const searchQuerySchema = paginationQuerySchema
  .extend({
    /** Empty when browsing a category, which the provider can do without words. */
    q: z.string().trim().max(100).default(''),
    orientation: imageOrientationSchema.default('all'),
    color: searchColorSchema.optional(),
    /** A colour picked from the wheel. Matched to the nearest name the provider knows. */
    colorHex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #4f46e5')
      .optional(),
    type: imageTypeSchema.default('all'),
    category: searchCategorySchema.optional(),
    order: searchOrderSchema.default('popular'),
    /** Pixabay's own pick of the best of a search. */
    editorsChoice: z.stringbool().default(false),
    minWidth: z.coerce.number().int().min(0).max(6000).optional(),
    minHeight: z.coerce.number().int().min(0).max(6000).optional(),
  })
  .refine(isSearchable, {
    error: 'Say what to look for, or pick a category or a colour',
  });
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Attribution shown wherever an image appears. Required by Pixabay's terms. */
export const imageCreditSchema = z.object({
  name: z.string(),
  profileUrl: z.url().nullable(),
});
export type ImageCredit = z.infer<typeof imageCreditSchema>;

/**
 * One search hit. The URLs here are the provider's and are temporary
 * (Pixabay's expire after 24 hours), so they are displayed but never stored.
 * Saving an image sends providerImageId to the backend, which downloads it.
 */
export const searchResultSchema = z.object({
  provider: imageProviderSchema,
  providerImageId: z.string(),
  /** Small thumbnail (about 150px) used as the instant placeholder in the grid. */
  previewUrl: z.url(),
  previewWidth: z.number().int().positive(),
  previewHeight: z.number().int().positive(),
  /** Medium image (about 640px) shown in the grid once loaded. */
  displayUrl: z.url(),
  /** Dimensions of the full-size original, used for aspect-ratio layout. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tags: z.array(z.string()),
  credit: imageCreditSchema,
  /** Provider page for this image, linked for attribution. */
  sourceUrl: z.url(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  page: z.number().int().min(1),
  perPage: z.number().int().min(1),
  /** Total hits reachable through pagination for this query. */
  total: z.number().int().nonnegative(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
