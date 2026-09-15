import type {
  Collection,
  CollectionDetailResponse,
  CollectionListResponse,
  CreateCollectionRequest,
  PaginationQuery,
  UpdateCollectionRequest,
} from '@trove/shared';
import { http } from '@/lib/api';

export const collectionsApi = {
  list: () => http.get<CollectionListResponse>('/collections'),
  explore: (query: Partial<PaginationQuery>) =>
    http.get<CollectionListResponse>('/explore', { query }),
  get: (id: string) => http.get<CollectionDetailResponse>(`/collections/${id}`),
  create: (body: CreateCollectionRequest) => http.post<Collection>('/collections', body),
  update: (id: string, body: UpdateCollectionRequest) =>
    http.patch<Collection>(`/collections/${id}`, body),
  remove: (id: string) => http.delete(`/collections/${id}`),
};
