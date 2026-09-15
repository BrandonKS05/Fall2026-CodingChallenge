import type { ProfileSummary } from '../../../domain/entities/Profile.js';

export interface FollowListOptions {
  limit: number;
  /** Whose "do I follow them" flag each row carries. Null for a visitor. */
  viewerId: string | null;
}

export interface FollowRepository {
  /** Resolves true when this is a new follow, false when it already existed. */
  follow(followerId: string, followeeId: string): Promise<boolean>;
  /** Resolves true when a follow was removed. */
  unfollow(followerId: string, followeeId: string): Promise<boolean>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  counts(userId: string): Promise<{ followers: number; following: number }>;
  /** People who follow this user, most recent first. */
  listFollowers(userId: string, options: FollowListOptions): Promise<ProfileSummary[]>;
  /** People this user follows, most recent first. */
  listFollowing(userId: string, options: FollowListOptions): Promise<ProfileSummary[]>;
}
