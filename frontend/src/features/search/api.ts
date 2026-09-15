import type { SearchQuery, SearchResponse } from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const searchApi = {
  search: (query: SearchQuery) => http.get<SearchResponse>('/search', { query }),
};
