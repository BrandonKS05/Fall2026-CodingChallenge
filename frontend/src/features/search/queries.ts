import type { SearchQuery } from '@trove/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { searchApi } from './api';

export const SEARCH_PAGE_SIZE = 30;

export type SearchParams = Pick<SearchQuery, 'q' | 'orientation'> & { color?: SearchQuery['color'] };

/**
 * Pages of results for a query. Pixabay caps reachable hits at 500, and the
 * backend caches each page for a day, so revisiting a query is instant.
 */
export function useImageSearch(params: SearchParams) {
  const q = params.q.trim();
  return useInfiniteQuery({
    queryKey: queryKeys.search({ ...params, q }),
    queryFn: ({ pageParam }) =>
      searchApi.search({ ...params, q, page: pageParam, perPage: SEARCH_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.perPage < last.total ? last.page + 1 : undefined),
    enabled: q.length > 0,
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });
}
