import type { Collection, CollectionDetailResponse, UpdateCollectionRequest } from '@wumboo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { collectionsApi } from './api';

/**
 * The signed-in user's boards. Pages a visitor can see pass `enabled: false`
 * while signed out, so the request (which needs a session) is never made and
 * never surfaces a 401 as an error toast.
 */
/** Every image on every public board, interleaved by the server so no board dominates. */
export function useExploreImages(limit: number) {
  return useQuery({
    queryKey: queryKeys.exploreImages({ limit }),
    queryFn: () => collectionsApi.exploreImages(limit).then((response) => response.images),
  });
}

/** Public boards whose title or description carries the words. */
export function useBoardSearch(term: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.boardSearch(term),
    queryFn: () => collectionsApi.search(term),
    enabled: enabled && term !== '',
    staleTime: 60_000,
    meta: { silentError: true },
  });
}

export function useBoards(enabled = true) {
  return useQuery({
    queryKey: queryKeys.collections.list(),
    queryFn: () => collectionsApi.list().then((response) => response.collections),
    enabled,
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

/** Toggles a like with an optimistic count, then trusts the server's answer. */
export function useLikeBoard(id: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.collections.detail(id);

  return useMutation({
    mutationFn: (liked: boolean) => (liked ? collectionsApi.like(id) : collectionsApi.unlike(id)),
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<CollectionDetailResponse>(detailKey);
      if (previous) {
        queryClient.setQueryData<CollectionDetailResponse>(detailKey, {
          ...previous,
          collection: {
            ...previous.collection,
            likedByViewer: liked,
            likeCount: Math.max(0, previous.collection.likeCount + (liked ? 1 : -1)),
          },
        });
      }
      return { previous };
    },
    onError: (_error, _liked, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous);
    },
    onSuccess: (collection) => {
      queryClient.setQueryData<CollectionDetailResponse>(detailKey, (current) =>
        current ? { ...current, collection } : current,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.list() });
    },
    meta: { silentError: true },
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
