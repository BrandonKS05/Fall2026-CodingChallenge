/**
 * Query key factory. Keys are hierarchical so invalidating a parent
 * (e.g. every collection query) is one call.
 */
import type { SearchQuery } from '@wumboo/shared';

export const queryKeys = {
  session: ['session'] as const,
  search: (params: Partial<SearchQuery>) => ['search', params] as const,
  collections: {
    all: ['collections'] as const,
    list: () => ['collections', 'list'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
    members: (id: string) => ['collections', 'detail', id, 'members'] as const,
  },
  /** The landing stage's feed. Its own root, so board edits never reshuffle the stage mid-visit. */
  exploreImages: (params: { limit: number }) => ['explore', 'images', params] as const,
  shared: (slug: string) => ['shared', slug] as const,
  notifications: ['notifications'] as const,
  /** The person's own saves across boards; every item mutation invalidates it. */
  savedItems: {
    all: ['saved-items'] as const,
    list: (params: { limit: number }) => ['saved-items', params] as const,
  },
};
