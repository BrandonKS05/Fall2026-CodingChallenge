import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileResponse } from '@wumboo/shared';
import { queryKeys } from '@/lib/api';
import { socialApi } from './api';

export function useProfile(handle: string) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(handle),
    queryFn: () => socialApi.profile(handle),
    enabled: handle !== '',
  });
}

/**
 * Following and unfollowing answer with the whole profile, so the counts and
 * the boards a follow just unlocked arrive together with the button's new state.
 */
export function useFollow(handle: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (following: boolean) =>
      following ? socialApi.follow(handle) : socialApi.unfollow(handle),
    onSuccess: (profile: ProfileResponse) => {
      queryClient.setQueryData(queryKeys.profiles.detail(handle), profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.lists(handle) });
    },
    meta: { silentError: true },
  });
}

export function useFollowList(handle: string, direction: 'followers' | 'following', open: boolean) {
  return useQuery({
    queryKey: queryKeys.profiles.list(handle, direction),
    queryFn: () =>
      direction === 'followers' ? socialApi.followers(handle) : socialApi.following(handle),
    // A handle arrives with the session, so until it does there is nothing to ask for.
    enabled: open && handle !== '',
    meta: { silentError: true },
  });
}
