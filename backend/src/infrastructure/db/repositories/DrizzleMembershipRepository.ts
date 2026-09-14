import { and, asc, eq, sql } from 'drizzle-orm';
import type {
  CollectionRole,
  MemberDetail,
  Membership,
} from '../../../domain/entities/Membership.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type {
  MembershipRepository,
  NewMembership,
} from '../../../ports/repositories/MembershipRepository.js';
import type { Db } from '../client.js';
import { isUniqueViolation } from '../errors.js';
import { collectionMembers, users } from '../schema/index.js';

type MembershipRow = typeof collectionMembers.$inferSelect;

const toMembership = (row: MembershipRow): Membership => ({
  collectionId: row.collectionId,
  userId: row.userId,
  role: row.role,
  createdAt: row.createdAt,
});

/** Owner first, then editors, then viewers, each oldest first. */
const roleOrder = sql`case ${collectionMembers.role} when 'owner' then 0 when 'editor' then 1 else 2 end`;

export class DrizzleMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Db) {}

  async find(collectionId: string, userId: string): Promise<Membership | null> {
    const row = await this.db.query.collectionMembers.findFirst({
      where: and(
        eq(collectionMembers.collectionId, collectionId),
        eq(collectionMembers.userId, userId),
      ),
    });
    return row ? toMembership(row) : null;
  }

  async listByCollection(collectionId: string): Promise<MemberDetail[]> {
    const rows = await this.db
      .select({
        collectionId: collectionMembers.collectionId,
        userId: collectionMembers.userId,
        role: collectionMembers.role,
        createdAt: collectionMembers.createdAt,
        email: users.email,
        displayName: users.displayName,
      })
      .from(collectionMembers)
      .innerJoin(users, eq(users.id, collectionMembers.userId))
      .where(eq(collectionMembers.collectionId, collectionId))
      .orderBy(roleOrder, asc(collectionMembers.createdAt));
    return rows;
  }

  async listMemberIds(collectionId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: collectionMembers.userId })
      .from(collectionMembers)
      .where(eq(collectionMembers.collectionId, collectionId));
    return rows.map((row) => row.userId);
  }

  async add(input: NewMembership): Promise<Membership> {
    try {
      const [row] = await this.db.insert(collectionMembers).values(input).returning();
      if (!row) throw new Error('Insert returned no row');
      return toMembership(row);
    } catch (error) {
      if (isUniqueViolation(error, 'collection_members_collection_id_user_id_pk')) {
        throw new ConflictError('User is already a member of this board');
      }
      throw error;
    }
  }

  async updateRole(collectionId: string, userId: string, role: CollectionRole): Promise<Membership> {
    const [row] = await this.db
      .update(collectionMembers)
      .set({ role })
      .where(
        and(eq(collectionMembers.collectionId, collectionId), eq(collectionMembers.userId, userId)),
      )
      .returning();
    if (!row) throw new NotFoundError('Membership');
    return toMembership(row);
  }

  async remove(collectionId: string, userId: string): Promise<void> {
    await this.db
      .delete(collectionMembers)
      .where(
        and(eq(collectionMembers.collectionId, collectionId), eq(collectionMembers.userId, userId)),
      );
  }
}
