/**
 * Item mutations update the board page optimistically and roll back on
 * failure, so removing or captioning feels instant even on a slow link.
 */
import type {
  CollectionDetailResponse,
  CreateItemRequest,
  UpdateItemRequest,
} from '@wumboo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { itemsApi } from './api';

type Detail = CollectionDetailResponse;

export function useAddItem(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemRequest) => itemsApi.add(collectionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(collectionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
    },
  });
}

export function useUpdateItem(collectionId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.collections.detail(collectionId);

  return useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: UpdateItemRequest }) =>
      itemsApi.update(collectionId, itemId, patch),
    onMutate: async ({ itemId, patch }) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<Detail>(detailKey);
      if (previous) {
        const moving = patch.collectionId !== undefined && patch.collectionId !== collectionId;
        queryClient.setQueryData<Detail>(detailKey, {
          ...previous,
          items: moving
            ? previous.items.filter((item) => item.id !== itemId)
            : previous.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      caption: patch.caption ?? item.caption,
                      tags: patch.tags ?? item.tags,
                      position: patch.position ?? item.position,
                    }
                  : item,
              ),
        });
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },
    onSettled: (_result, _error, { patch }) => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
      if (patch.collectionId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.collections.detail(patch.collectionId),
        });
      }
    },
  });
}

export function useRemoveItem(collectionId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.collections.detail(collectionId);

  return useMutation({
    mutationFn: (itemId: string) => itemsApi.remove(collectionId, itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<Detail>(detailKey);
      if (previous) {
        queryClient.setQueryData<Detail>(detailKey, {
          ...previous,
          collection: {
            ...previous.collection,
            itemCount: Math.max(0, previous.collection.itemCount - 1),
          },
          items: previous.items.filter((item) => item.id !== itemId),
        });
      }
      return { previous };
    },
    onError: (_error, _itemId, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
    },
  });
}

/** Save from search into any board. Invalidates that board so its count and cover update. */
export function useSaveToBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, body }: { collectionId: string; body: CreateItemRequest }) =>
      itemsApi.add(collectionId, body),
    onSuccess: (_item, { collectionId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.detail(collectionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
    },
    meta: { silentError: true },
  });
}
