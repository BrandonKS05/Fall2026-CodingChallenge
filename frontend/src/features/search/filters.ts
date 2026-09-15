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

/**
 * What a search is looking for. Everything by default; an @ in the box overrides
 * it, because that is how people write a handle when they mean a person.
 */
export const SCOPES = ['all', 'images', 'collections', 'people'] as const;
export type SearchScope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'Everything',
  images: 'Images',
  collections: 'Boards',
  people: 'People',
};

export type SearchFilters = Pick<SearchQuery, 'q' | 'orientation' | 'type' | 'order'> & {
  scope: SearchScope;
  color?: SearchQuery['color'];
  colorHex?: string;
  category?: SearchQuery['category'];
  editorsChoice: boolean;
  minWidth?: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  scope: 'all',
  orientation: 'all',
  type: 'all',
  order: 'popular',
  editorsChoice: false,
};

/** Which filters are set beyond the defaults — the number on the Filters button. */
export function activeFilterCount(filters: SearchFilters): number {
  return [
    filters.scope !== 'all',
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
  const scope = SCOPES.find((value) => value === params.get('in'));

  return {
    q: params.get('q') ?? '',
    scope: scope ?? 'all',
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
  if (filters.scope !== 'all') params.set('in', filters.scope);
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

/**
 * What this query is actually asking for. While the filter says "everything",
 * an @ in front of the words narrows it to people, because that is how people
 * write a handle. A filter someone set by hand is never overruled.
 */
export function effectiveScope(filters: SearchFilters): SearchScope {
  return filters.scope === 'all' && filters.q.trim().startsWith('@') ? 'people' : filters.scope;
}

/** The words to search with, without the @ that chose the scope. */
export function searchTerm(filters: SearchFilters): string {
  return filters.q.trim().replace(/^@+/, '');
}

/** Whether a kind of thing takes part in this search. */
export function scopeIncludes(filters: SearchFilters, kind: Exclude<SearchScope, 'all'>): boolean {
  const scope = effectiveScope(filters);
  return scope === 'all' || scope === kind;
}

/**
 * The image query these filters describe: the words without the @ that chose a
 * scope, and nothing about scope itself, which is the client's business.
 */
export function toImageQuery(filters: SearchFilters): Omit<SearchFilters, 'scope'> {
  const { scope: _scope, ...rest } = filters;
  return { ...rest, q: searchTerm(filters) };
}
