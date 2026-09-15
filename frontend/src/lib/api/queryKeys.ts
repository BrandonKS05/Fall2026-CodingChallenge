/**
 * Query key factory. Keys are hierarchical so invalidating a parent
 * (e.g. every collection query) is one call.
 */
import type { SearchQuery } from '@wumboo/shared';

export const queryKeys = {
  session: ['session'] as const,
  /** Whether a handle is free. Its own key per handle, so typing back and forth is free. */
  handleAvailability: (handle: string) => ['handle-availability', handle] as const,
  search: (params: Partial<SearchQuery>) => ['search', params] as const,
  collections: {
    all: ['collections'] as const,
    list: () => ['collections', 'list'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
    members: (id: string) => ['collections', 'detail', id, 'members'] as const,
  },
  /** Explore's gallery of images from public boards. */
  exploreImages: (params: { limit: number }) => ['explore', 'images', params] as const,
  /** The landing stage's fixed curation. Nothing anyone posts can change it. */
  landingImages: (params: { limit: number }) => ['landing', 'images', params] as const,
  shared: (slug: string) => ['shared', slug] as const,
  notifications: ['notifications'] as const,
  /** Direct messages: the inbox, and one conversation's history. */
  conversations: {
    all: ['conversations'] as const,
    list: () => ['conversations', 'list'] as const,
    messages: (id: string) => ['conversations', 'detail', id, 'messages'] as const,
  },
  /** The person's own saves across boards; every item mutation invalidates it. */
  savedItems: {
    all: ['saved-items'] as const,
    list: (params: { limit: number }) => ['saved-items', params] as const,
  },
};
