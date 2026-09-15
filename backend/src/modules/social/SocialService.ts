/**
 * Public profiles and the follow graph. A profile is the one place someone
 * else's account is visible, so everything here reads as a visitor would see
 * it: public boards only, and every "do I follow them" answered for whoever
 * is asking.
 */
import type { CollectionSummary, CollectionVisibility } from '../../domain/entities/Collection.js';
import type { ProfileSummary, PublicProfile } from '../../domain/entities/Profile.js';
import { ForbiddenError, InvalidOperationError, NotFoundError } from '../../domain/errors/index.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { User } from '../../domain/entities/User.js';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import type { CollectionRepository } from '../collections/ports/CollectionRepository.js';
import type { FollowRepository } from './ports/FollowRepository.js';

export interface SocialServiceDeps {
  users: UserRepository;
  follows: FollowRepository;
  collections: CollectionRepository;
  logger: Logger;
}

export interface ProfilePage {
  profile: PublicProfile;
  boards: CollectionSummary[];
}

export class SocialService {
  private readonly log: Logger;

  constructor(private readonly deps: SocialServiceDeps) {
    this.log = deps.logger.child({ service: 'SocialService' });
  }

  /** Someone's page: who they are, their counts, and the boards they made public. */
  async profile(handle: string, viewerId: string | null): Promise<ProfilePage> {
    const user = await this.requireUser(handle);
    // A profile is reached by its handle, not by browsing, so it ignores the
    // discovery setting: that one governs whether Explore lists the boards.
    const [counts, followedByViewer] = await Promise.all([
      this.deps.follows.counts(user.id),
      viewerId === null ? false : this.deps.follows.isFollowing(viewerId, user.id),
    ]);
    const isViewer = user.id === viewerId;
    const boards = await this.deps.collections.listByOwner(user.id, {
      viewerId,
      visibilities: visibleTo({ isViewer, followedByViewer }),
    });

    return {
      profile: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        joinedAt: user.createdAt,
        followerCount: counts.followers,
        followingCount: counts.following,
        boardCount: boards.length,
        followedByViewer,
        isViewer,
        canSeeFollowList: allowsFollowList(user, viewerId, followedByViewer),
      },
      boards,
    };
  }

  /** Following someone twice is not an error; it simply stays followed. */
  async follow(viewerId: string, handle: string): Promise<ProfilePage> {
    const user = await this.requireUser(handle);
    if (user.id === viewerId) throw new InvalidOperationError('You cannot follow yourself');

    if (await this.deps.follows.follow(viewerId, user.id)) {
      this.log.info({ followerId: viewerId, followeeId: user.id }, 'Followed');
    }
    return this.profile(handle, viewerId);
  }

  async unfollow(viewerId: string, handle: string): Promise<ProfilePage> {
    const user = await this.requireUser(handle);
    await this.deps.follows.unfollow(viewerId, user.id);
    return this.profile(handle, viewerId);
  }

  /** Finding people, by the handle they are known by or the name they show. */
  async searchPeople(
    term: string,
    viewerId: string | null,
    limit: number,
  ): Promise<ProfileSummary[]> {
    if (term.trim() === '') return [];
    return this.deps.follows.searchProfiles(term, { limit, viewerId });
  }

  async followers(
    handle: string,
    viewerId: string | null,
    limit: number,
  ): Promise<ProfileSummary[]> {
    const user = await this.requireFollowListAccess(handle, viewerId);
    return this.deps.follows.listFollowers(user.id, { limit, viewerId });
  }

  async following(
    handle: string,
    viewerId: string | null,
    limit: number,
  ): Promise<ProfileSummary[]> {
    const user = await this.requireFollowListAccess(handle, viewerId);
    return this.deps.follows.listFollowing(user.id, { limit, viewerId });
  }

  /** Both lists answer to one setting, so both ask the same question first. */
  private async requireFollowListAccess(handle: string, viewerId: string | null): Promise<User> {
    const user = await this.requireUser(handle);
    const followsThem =
      viewerId === null ? false : await this.deps.follows.isFollowing(viewerId, user.id);
    if (!allowsFollowList(user, viewerId, followsThem)) {
      throw new ForbiddenError('This person keeps their followers to themselves');
    }
    return user;
  }

  private async requireUser(handle: string): Promise<User> {
    const user = await this.deps.users.findByHandle(handle);
    if (!user) throw new NotFoundError('User', handle);
    return user;
  }
}

/** Which of someone's boards a viewer has earned the right to see on their profile. */
function visibleTo({
  isViewer,
  followedByViewer,
}: {
  isViewer: boolean;
  followedByViewer: boolean;
}): CollectionVisibility[] {
  if (isViewer) return ['private', 'unlisted', 'followers', 'public'];
  return followedByViewer ? ['followers', 'public'] : ['public'];
}

/** The follower and following lists answer to their owner's setting. */
function allowsFollowList(user: User, viewerId: string | null, followsThem: boolean): boolean {
  if (user.id === viewerId) return true;
  switch (user.preferences.followListsVisibleTo) {
    case 'everyone':
      return true;
    case 'followers':
      return followsThem;
    case 'private':
      return false;
  }
}
