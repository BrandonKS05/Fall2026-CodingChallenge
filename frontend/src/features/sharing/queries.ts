import type { CollectionDetailResponse, GrantableRole, InviteMemberRequest } from '@trove/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { sharingApi } from './api';

type Detail = CollectionDetailResponse;

export function useSharedBoard(slug: string) {
  return useQuery({
    queryKey: queryKeys.shared(slug),
    queryFn: () => sharingApi.openShared(slug),
    retry: false,
    meta: { silentError: true },
  });
}

/** Members are visible to members only, so the caller passes whether to ask. */
export function useMembers(collectionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.collections.members(collectionId),
    queryFn: () => sharingApi.listMembers(collectionId).then((response) => response.members),
    enabled,
    meta: { silentError: true },
  });
}

/** After the server answers, patch the cached board with what it now looks like, then confirm. */
function applyLinkChange(queryClient: QueryClient, collectionId: string, slug: string | null) {
  queryClient.setQueryData<Detail>(queryKeys.collections.detail(collectionId), (previous) => {
    if (!previous) return previous;
    const { visibility } = previous.collection;
    const nextVisibility =
      slug && visibility === 'private' ? 'unlisted' : !slug && visibility === 'unlisted' ? 'private' : visibility;
    return { ...previous, collection: { ...previous.collection, shareSlug: slug, visibility: nextVisibility } };
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
}

export function useCreateShareLink(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sharingApi.createLink(collectionId),
    onSuccess: ({ slug }) => applyLinkChange(queryClient, collectionId, slug),
  });
}

export function useRevokeShareLink(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sharingApi.revokeLink(collectionId),
    onSuccess: () => applyLinkChange(queryClient, collectionId, null),
  });
}

export function useInviteMember(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteMemberRequest) => sharingApi.invite(collectionId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collections.members(collectionId) }),
    meta: { silentError: true },
  });
}

export function useUpdateMemberRole(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: GrantableRole }) =>
      sharingApi.updateRole(collectionId, userId, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.collections.members(collectionId) }),
  });
}

export function useRemoveMember(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => sharingApi.removeMember(collectionId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.members(collectionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}
