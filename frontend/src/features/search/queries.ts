import { isSearchable, type SearchQuery } from '@wumboo/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { searchApi } from './api';

const SEARCH_PAGE_SIZE = 30;

/** The browse grid's covers. They are a fixed curation, so they never go stale. */
export function useCategoryCovers() {
  return useQuery({
    queryKey: queryKeys.categoryCovers,
    queryFn: () => searchApi.categoryCovers(),
    staleTime: Infinity,
    meta: { silentError: true },
  });
}

export type SearchParams = Omit<SearchQuery, 'page' | 'perPage'>;

/**
 * Pages of results for a query. Pixabay caps reachable hits at 500, and the
 * backend caches each page for a day, so revisiting a query is instant.
 */
export function useImageSearch(params: SearchParams, enabled = true) {
  const q = params.q.trim();
  // A category or a colour browses on its own; words are not required — but a
  // search for people has no use for any of it.
  const wanted = enabled && isSearchable({ ...params, q });
  return useInfiniteQuery({
    queryKey: queryKeys.search({ ...params, q }),
    queryFn: ({ pageParam }) =>
      searchApi.search({ ...params, q, page: pageParam, perPage: SEARCH_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.perPage < last.total ? last.page + 1 : undefined),
    enabled: wanted,
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });
}
