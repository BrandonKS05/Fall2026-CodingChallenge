import type {
  CreateItemRequest,
  Item,
  SavedItemsResponse,
  UpdateItemRequest,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const itemsApi = {
  /** Everything the signed-in person has saved, across every board they belong to. */
  listMine: (limit: number) => http.get<SavedItemsResponse>('/items', { query: { limit } }),
  add: (collectionId: string, body: CreateItemRequest) =>
    http.post<Item>(`/collections/${collectionId}/items`, body),
  update: (collectionId: string, itemId: string, body: UpdateItemRequest) =>
    http.patch<Item>(`/collections/${collectionId}/items/${itemId}`, body),
  remove: (collectionId: string, itemId: string) =>
    http.delete(`/collections/${collectionId}/items/${itemId}`),
};
