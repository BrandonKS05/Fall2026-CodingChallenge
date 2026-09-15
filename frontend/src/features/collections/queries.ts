import type { Collection, CollectionDetailResponse, UpdateCollectionRequest } from '@trove/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { collectionsApi } from './api';

export const EXPLORE_PAGE_SIZE = 24;

export function useBoards() {
  return useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: () => collectionsApi.list().then((response) => response.collections),
  });
}

export function useExplore(page = 1) {
  return useQuery({
    queryKey: queryKeys.collections.explore({ page }),
    queryFn: () =>
      collectionsApi
        .explore({ page, perPage: EXPLORE_PAGE_SIZE })
        .then((response) => response.collections),
  });
}

/** The board page renders its own error states, so failures stay silent here. */
export function useBoard(id: string) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    queryFn: () => collectionsApi.get(id),
    retry: false,
    meta: { silentError: true },
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: collectionsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
  });
}

/** Optimistic: the board page and the list reflect the change before the server answers. */
export function useUpdateBoard(id: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.collections.detail(id);
  const listKey = queryKeys.collections.list();

  return useMutation({
    mutationFn: (patch: UpdateCollectionRequest) => collectionsApi.update(id, patch),
    onMutate: async (patch) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ]);
      const previousDetail = queryClient.getQueryData<CollectionDetailResponse>(detailKey);
      const previousList = queryClient.getQueryData<Collection[]>(listKey);
      if (previousDetail) {
        queryClient.setQueryData<CollectionDetailResponse>(detailKey, {
          ...previousDetail,
          collection: { ...previousDetail.collection, ...patch },
        });
      }
      if (previousList) {
        queryClient.setQueryData<Collection[]>(
          listKey,
          previousList.map((board) => (board.id === id ? { ...board, ...patch } : board)),
        );
      }
      return { previousDetail, previousList };
    },
    onError: (_error, _patch, context) => {
      if (context?.previousDetail) queryClient.setQueryData(detailKey, context.previousDetail);
      if (context?.previousList) queryClient.setQueryData(listKey, context.previousList);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsApi.remove(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.collections.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}
