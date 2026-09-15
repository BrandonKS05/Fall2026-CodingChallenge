import type {
  CollectionDetailResponse,
  InviteMemberRequest,
  Member,
  MemberListResponse,
  ShareLinkResponse,
  UpdateMemberRequest,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const sharingApi = {
  createLink: (collectionId: string) =>
    http.post<ShareLinkResponse>(`/collections/${collectionId}/share-link`),
  revokeLink: (collectionId: string) => http.delete(`/collections/${collectionId}/share-link`),
  openShared: (slug: string) => http.get<CollectionDetailResponse>(`/shared/${slug}`),
  listMembers: (collectionId: string) =>
    http.get<MemberListResponse>(`/collections/${collectionId}/members`),
  invite: (collectionId: string, body: InviteMemberRequest) =>
    http.post<Member>(`/collections/${collectionId}/members`, body),
  updateRole: (collectionId: string, userId: string, body: UpdateMemberRequest) =>
    http.patch<Member>(`/collections/${collectionId}/members/${userId}`, body),
  removeMember: (collectionId: string, userId: string) =>
    http.delete(`/collections/${collectionId}/members/${userId}`),
};
