import { and, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import type { ProfileSummary } from '../../../domain/entities/Profile.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { follows, users } from '../../../infrastructure/db/schema/index.js';
import type { FollowListOptions, FollowRepository } from '../ports/FollowRepository.js';

/** Whether `viewerId` follows the user in the row being read. Constant false for a visitor. */
const followedByViewer = (viewerId: string | null) =>
  viewerId === null
    ? sql<boolean>`false`
    : sql<boolean>`exists (
        select 1 from ${follows} f
        where f.follower_id = ${viewerId} and f.followee_id = ${users.id}
      )`;

export class DrizzleFollowRepository implements FollowRepository {
  constructor(private readonly db: Db) {}

  /** The primary key does the work: following twice changes nothing and says so. */
  async follow(followerId: string, followeeId: string): Promise<boolean> {
    const rows = await this.db
      .insert(follows)
      .values({ followerId, followeeId })
      .onConflictDoNothing()
      .returning({ followerId: follows.followerId });
    return rows.length > 0;
  }

  async unfollow(followerId: string, followeeId: string): Promise<boolean> {
    const rows = await this.db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
      .returning({ followerId: follows.followerId });
    return rows.length > 0;
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const row = await this.db.query.follows.findFirst({
      where: and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)),
    });
    return row !== undefined;
  }

  /** Both directions in one round trip, since a profile always shows both. */
  async counts(userId: string): Promise<{ followers: number; following: number }> {
    const [row] = await this.db
      .select({
        followers: sql<number>`(select count(*)::int from ${follows} f where f.followee_id = ${userId})`,
        following: sql<number>`(select count(*)::int from ${follows} f where f.follower_id = ${userId})`,
      })
      .from(sql`(select 1) as one`);
    return row ?? { followers: 0, following: 0 };
  }

  listFollowers(userId: string, options: FollowListOptions): Promise<ProfileSummary[]> {
    return this.list(eq(follows.followeeId, userId), follows.followerId, options);
  }

  listFollowing(userId: string, options: FollowListOptions): Promise<ProfileSummary[]> {
    return this.list(eq(follows.followerId, userId), follows.followeeId, options);
  }

  /**
   * A handle is what people search by, so a handle that starts with the words
   * comes before one that merely contains them, and both come before a match
   * on the display name alone.
   */
  searchProfiles(term: string, { limit, viewerId }: FollowListOptions): Promise<ProfileSummary[]> {
    const escaped = term.trim().replace(/[\\%_]/g, '\\$&');
    return this.db
      .select({
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
        bio: users.bio,
        followedByViewer: followedByViewer(viewerId),
      })
      .from(users)
      .where(
        and(
          or(ilike(users.handle, `%${escaped}%`), ilike(users.displayName, `%${escaped}%`)),
          // You already know where to find yourself.
          viewerId === null ? undefined : ne(users.id, viewerId),
        ),
      )
      .orderBy(
        sql`case
          when ${users.handle} ilike ${`${escaped}%`} then 0
          when ${users.handle} ilike ${`%${escaped}%`} then 1
          else 2
        end`,
        users.handle,
      )
      .limit(limit);
  }

  /** One shape for both directions: the same join, read from the other end. */
  private async list(
    where: SQL,
    personColumn: typeof follows.followerId | typeof follows.followeeId,
    { limit, viewerId }: FollowListOptions,
  ): Promise<ProfileSummary[]> {
    return this.db
      .select({
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
        bio: users.bio,
        followedByViewer: followedByViewer(viewerId),
      })
      .from(follows)
      .innerJoin(users, eq(users.id, personColumn))
      .where(where)
      .orderBy(desc(follows.createdAt), desc(users.id))
      .limit(limit);
  }
}
