/** Presenters turn domain objects into the shapes promised by @wumboo/shared. */
import type {
  FollowListResponse,
  ProfileResponse,
  ProfileSummary as ProfileSummaryDto,
} from '@wumboo/shared';
import type { ProfileSummary } from '../../domain/entities/Profile.js';
import { presentCollection } from '../collections/collection.presenter.js';
import type { ProfilePage } from './SocialService.js';

export function presentProfileSummary(profile: ProfileSummary): ProfileSummaryDto {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    followedByViewer: profile.followedByViewer,
  };
}

export function presentProfile(page: ProfilePage): ProfileResponse {
  return {
    profile: {
      ...presentProfileSummary(page.profile),
      joinedAt: page.profile.joinedAt.toISOString(),
      followerCount: page.profile.followerCount,
      followingCount: page.profile.followingCount,
      boardCount: page.profile.boardCount,
      isViewer: page.profile.isViewer,
    },
    boards: page.boards.map(presentCollection),
  };
}

export function presentFollowList(profiles: ProfileSummary[]): FollowListResponse {
  return { profiles: profiles.map(presentProfileSummary) };
}
