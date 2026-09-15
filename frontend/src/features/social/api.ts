import type { FollowListResponse, ProfileResponse } from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const socialApi = {
  profile: (handle: string) => http.get<ProfileResponse>(`/users/${encodeURIComponent(handle)}`),
  follow: (handle: string) =>
    http.post<ProfileResponse>(`/users/${encodeURIComponent(handle)}/follow`),
  unfollow: (handle: string) =>
    http.delete<ProfileResponse>(`/users/${encodeURIComponent(handle)}/follow`),
  followers: (handle: string) =>
    http.get<FollowListResponse>(`/users/${encodeURIComponent(handle)}/followers`),
  following: (handle: string) =>
    http.get<FollowListResponse>(`/users/${encodeURIComponent(handle)}/following`),
};
