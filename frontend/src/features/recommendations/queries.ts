import type { RecordInteractionRequest, SearchCategory } from '@wumboo/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { recommendationsApi } from './api';

/** How many come back per page. One screenful and a bit. */
const PAGE_SIZE = 12;

/**
 * The feed, page by page. The server freezes the order on the first request
 * and every later page is a slice of it, so scrolling never reshuffles even
 * though liking something changes what the next feed would look like.
 */
export function useRecommendations(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.recommendations({ limit: PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      recommendationsApi.feed({ limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled,
    // The slate outlives a remount, so there is no reason to re-ask on focus.
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { silentError: true },
  });
}

/**
 * Telling the server what somebody did. Nothing is awaited on their behalf and
 * a failure is swallowed: an interaction that does not land is a slightly worse
 * feed tomorrow, never an error in front of someone today.
 */
export function useRecordInteraction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RecordInteractionRequest) => recommendationsApi.record(body),
    onError: () => undefined,
    onSuccess: (_data, body) => {
      // A hide should take effect now rather than on the next feed.
      if (body.type === 'hide') {
        void client.invalidateQueries({
          queryKey: queryKeys.recommendations({ limit: PAGE_SIZE }),
        });
      }
    },
  });
}

/** The categories ticked at sign-up, which seed the first feed. */
export function useChooseInterests() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (categories: SearchCategory[]) =>
      recommendationsApi.chooseInterests({ categories }),
    // The feed was empty because there was nothing to go on; now there is.
    onSuccess: () => client.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}
