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
  /** One stored picture per category, for the browse grid. Fixed, so it is cached hard. */
  categoryCovers: ['search', 'categories'] as const,
  collections: {
    all: ['collections'] as const,
    list: () => ['collections', 'list'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
    members: (id: string) => ['collections', 'detail', id, 'members'] as const,
  },
  /** Every public board, for Explore's album wall. */
  exploreBoards: (params: { perPage: number }) => ['collections', 'explore', params] as const,
  /** Public boards matching some words, for the search surface. */
  boardSearch: (term: string) => ['collections', 'search', term] as const,
  /** People matching some words, for the search surface. */
  peopleSearch: (term: string) => ['profiles', 'search', term] as const,
  /** Explore's gallery of images from public boards. */
  exploreImages: (params: { limit: number }) => ['explore', 'images', params] as const,
  /** The landing stage's fixed curation. Nothing anyone posts can change it. */
  landingImages: (params: { limit: number }) => ['landing', 'images', params] as const,
  shared: (slug: string) => ['shared', slug] as const,
  /** Someone's public page, and the two lists hanging off it. */
  profiles: {
    all: ['profiles'] as const,
    detail: (handle: string) => ['profiles', handle] as const,
    lists: (handle: string) => ['profiles', handle, 'lists'] as const,
    list: (handle: string, direction: 'followers' | 'following') =>
      ['profiles', handle, 'lists', direction] as const,
  },
  notifications: ['notifications'] as const,
  /** Direct messages: the inbox, and one conversation's history. */
  conversations: {
    all: ['conversations'] as const,
    /** Both boxes, without touching the open conversation's messages. */
    lists: () => ['conversations', 'list'] as const,
    list: (box: 'inbox' | 'requests') => ['conversations', 'list', box] as const,
    messages: (id: string) => ['conversations', 'detail', id, 'messages'] as const,
  },
  /** The person's own saves across boards; every item mutation invalidates it. */
  savedItems: {
    all: ['saved-items'] as const,
    list: (params: { limit: number }) => ['saved-items', params] as const,
  },
};
