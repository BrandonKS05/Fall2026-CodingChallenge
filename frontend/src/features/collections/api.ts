import type {
  Collection,
  CollectionDetailResponse,
  CollectionListResponse,
  CreateCollectionRequest,
  ExploreImagesResponse,
  UpdateCollectionRequest,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const collectionsApi = {
  list: () => http.get<CollectionListResponse>('/collections'),
  search: (q: string) =>
    http.get<CollectionListResponse>('/explore', { query: { q, perPage: 24 } }),
  exploreImages: (limit: number) =>
    http.get<ExploreImagesResponse>('/explore/images', { query: { limit } }),
  get: (id: string) => http.get<CollectionDetailResponse>(`/collections/${id}`),
  create: (body: CreateCollectionRequest) => http.post<Collection>('/collections', body),
  update: (id: string, body: UpdateCollectionRequest) =>
    http.patch<Collection>(`/collections/${id}`, body),
  remove: (id: string) => http.delete(`/collections/${id}`),
  like: (id: string) => http.post<Collection>(`/collections/${id}/like`),
  unlike: (id: string) => http.delete<Collection>(`/collections/${id}/like`),
};
