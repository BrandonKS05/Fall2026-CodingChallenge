/**
 * Query key factory. Keys are hierarchical so invalidating a parent
 * (e.g. every collection query) is one call.
 */
import type { PaginationQuery, SearchQuery } from '@wumboo/shared';

export const queryKeys = {
  session: ['session'] as const,
  search: (params: Partial<SearchQuery>) => ['search', params] as const,
  collections: {
    all: ['collections'] as const,
    list: () => ['collections', 'list'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
    members: (id: string) => ['collections', 'detail', id, 'members'] as const,
    explore: (params: Partial<PaginationQuery>) => ['collections', 'explore', params] as const,
  },
  shared: (slug: string) => ['shared', slug] as const,
  notifications: ['notifications'] as const,
};
