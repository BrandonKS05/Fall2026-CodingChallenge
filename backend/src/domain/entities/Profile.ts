/** One row in a followers or following list: enough to show a person and act on them. */
export interface ProfileSummary {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  /** Whether the person asking already follows this one. False for a visitor. */
  followedByViewer: boolean;
}

/** Someone's public page: who they are, and how the person looking relates to them. */
export interface PublicProfile extends ProfileSummary {
  joinedAt: Date;
  followerCount: number;
  followingCount: number;
  /** Public boards only. A profile shows what its owner chose to show. */
  boardCount: number;
  isViewer: boolean;
  /** Whether the person looking may open the follower and following lists. */
  canSeeFollowList: boolean;
}
