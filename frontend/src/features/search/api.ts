import type { SearchQuery, SearchResponse } from '@wumboo/shared';
import { http } from '@/lib/api';

export const searchApi = {
  search: (query: SearchQuery) => http.get<SearchResponse>('/search', { query }),
};
