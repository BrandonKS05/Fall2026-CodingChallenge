/**
 * Everything the search form can ask for, in one place, plus the translation to
 * and from the URL. The URL is the source of truth so a filtered search can be
 * linked, reloaded, and walked back through with the browser's own buttons.
 */
import {
  imageTypeSchema,
  searchCategorySchema,
  searchColorSchema,
  searchOrderSchema,
  type SearchQuery,
} from '@wumboo/shared';

export type SearchFilters = Pick<SearchQuery, 'q' | 'orientation' | 'type' | 'order'> & {
  color?: SearchQuery['color'];
  colorHex?: string;
  category?: SearchQuery['category'];
  editorsChoice: boolean;
  minWidth?: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  orientation: 'all',
  type: 'all',
  order: 'popular',
  editorsChoice: false,
};

/** Which filters are set beyond the defaults — the number on the Filters button. */
export function activeFilterCount(filters: SearchFilters): number {
  return [
    filters.orientation !== 'all',
    filters.type !== 'all',
    filters.order !== 'popular',
    filters.category !== undefined,
    filters.color !== undefined || filters.colorHex !== undefined,
    filters.editorsChoice,
    filters.minWidth !== undefined,
  ].filter(Boolean).length;
}

export function readFilters(params: URLSearchParams): SearchFilters {
  const orientation = params.get('orientation');
  const color = searchColorSchema.safeParse(params.get('color'));
  const category = searchCategorySchema.safeParse(params.get('category'));
  const type = imageTypeSchema.safeParse(params.get('type'));
  const order = searchOrderSchema.safeParse(params.get('order'));
  const hex = params.get('hex');
  const minWidth = Number(params.get('minWidth'));

  return {
    q: params.get('q') ?? '',
    orientation: orientation === 'horizontal' || orientation === 'vertical' ? orientation : 'all',
    type: type.success ? type.data : 'all',
    order: order.success ? order.data : 'popular',
    editorsChoice: params.get('editors') === '1',
    ...(color.success && { color: color.data }),
    ...(hex && /^#[0-9a-f]{6}$/i.test(hex) && { colorHex: hex }),
    ...(category.success && { category: category.data }),
    ...(Number.isFinite(minWidth) && minWidth > 0 && { minWidth }),
  };
}

/** Only what differs from the defaults reaches the URL, so a plain search stays a plain URL. */
export function writeFilters(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.orientation !== 'all') params.set('orientation', filters.orientation);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.order !== 'popular') params.set('order', filters.order);
  if (filters.category) params.set('category', filters.category);
  if (filters.colorHex) params.set('hex', filters.colorHex);
  else if (filters.color) params.set('color', filters.color);
  if (filters.editorsChoice) params.set('editors', '1');
  if (filters.minWidth) params.set('minWidth', String(filters.minWidth));
  return params;
}
