import type { ProfileSummary } from '../../domain/entities/Profile.js';
import type {
  FollowListOptions,
  FollowRepository,
} from '../../modules/social/ports/FollowRepository.js';
import { nextInstant } from './clock.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

interface Edge {
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

/** Port-conformant fake. Edges are unique per pair, as the primary key makes them. */
export class InMemoryFollowRepository implements FollowRepository {
  private readonly edges: Edge[] = [];

  constructor(private readonly users: InMemoryUserRepository) {}

  async follow(followerId: string, followeeId: string): Promise<boolean> {
    if (await this.isFollowing(followerId, followeeId)) return false;
    this.edges.push({ followerId, followeeId, createdAt: nextInstant() });
    return true;
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const index = this.edges.findIndex(
      (edge) => edge.followerId === followerId && edge.followeeId === followeeId,
    );
    if (index === -1) return false;
    this.edges.splice(index, 1);
    return true;
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.edges.some(
      (edge) => edge.followerId === followerId && edge.followeeId === followeeId,
    );
  }

  async counts(userId: string): Promise<{ followers: number; following: number }> {
    return {
      followers: this.edges.filter((edge) => edge.followeeId === userId).length,
      following: this.edges.filter((edge) => edge.followerId === userId).length,
    };
  }

  async searchProfiles(term: string, options: FollowListOptions): Promise<ProfileSummary[]> {
    const needle = term.trim().toLowerCase();
    const found = this.users
      .all()
      .filter(
        (user) =>
          user.id !== options.viewerId &&
          (user.handle.toLowerCase().includes(needle) ||
            user.displayName.toLowerCase().includes(needle)),
      );
    const rank = (handle: string) =>
      handle.toLowerCase().startsWith(needle) ? 0 : handle.toLowerCase().includes(needle) ? 1 : 2;
    return found
      .sort((a, b) => rank(a.handle) - rank(b.handle) || a.handle.localeCompare(b.handle))
      .slice(0, options.limit)
      .map((user) => ({
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        followedByViewer:
          options.viewerId !== null &&
          this.edges.some(
            (edge) => edge.followerId === options.viewerId && edge.followeeId === user.id,
          ),
      }));
  }

  listFollowers(userId: string, options: FollowListOptions): Promise<ProfileSummary[]> {
    return this.list(
      this.edges.filter((edge) => edge.followeeId === userId),
      (edge) => edge.followerId,
      options,
    );
  }

  listFollowing(userId: string, options: FollowListOptions): Promise<ProfileSummary[]> {
    return this.list(
      this.edges.filter((edge) => edge.followerId === userId),
      (edge) => edge.followeeId,
      options,
    );
  }

  private async list(
    edges: Edge[],
    personOf: (edge: Edge) => string,
    { limit, viewerId }: FollowListOptions,
  ): Promise<ProfileSummary[]> {
    const newestFirst = [...edges].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const profiles: ProfileSummary[] = [];
    for (const edge of newestFirst.slice(0, limit)) {
      const user = await this.users.findById(personOf(edge));
      if (!user) continue;
      profiles.push({
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        bio: user.bio,
        followedByViewer: viewerId !== null && (await this.isFollowing(viewerId, user.id)),
      });
    }
    return profiles;
  }
}
