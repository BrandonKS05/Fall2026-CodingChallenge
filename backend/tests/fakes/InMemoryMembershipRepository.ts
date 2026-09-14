import type { CollectionRole, MemberDetail, Membership } from '../../src/domain/entities/Membership.js';
import { ConflictError, NotFoundError } from '../../src/domain/errors/index.js';
import type {
  MembershipRepository,
  NewMembership,
} from '../../src/ports/repositories/MembershipRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

const ROLE_ORDER: Record<CollectionRole, number> = { owner: 0, editor: 1, viewer: 2 };

export class InMemoryMembershipRepository implements MembershipRepository {
  readonly rows = new Map<string, Membership>();

  constructor(private readonly users: InMemoryUserRepository) {}

  private key(collectionId: string, userId: string): string {
    return `${collectionId}:${userId}`;
  }

  async find(collectionId: string, userId: string): Promise<Membership | null> {
    return this.rows.get(this.key(collectionId, userId)) ?? null;
  }

  async listByCollection(collectionId: string): Promise<MemberDetail[]> {
    const members = [...this.rows.values()].filter((row) => row.collectionId === collectionId);
    members.sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return Promise.all(
      members.map(async (row) => {
        const user = await this.users.findById(row.userId);
        return { ...row, email: user?.email ?? '', displayName: user?.displayName ?? '' };
      }),
    );
  }

  async listMemberIds(collectionId: string): Promise<string[]> {
    return [...this.rows.values()]
      .filter((row) => row.collectionId === collectionId)
      .map((row) => row.userId);
  }

  async add(input: NewMembership): Promise<Membership> {
    const key = this.key(input.collectionId, input.userId);
    if (this.rows.has(key)) throw new ConflictError('User is already a member of this board');
    const membership: Membership = { ...input, createdAt: new Date() };
    this.rows.set(key, membership);
    return membership;
  }

  async updateRole(collectionId: string, userId: string, role: CollectionRole): Promise<Membership> {
    const existing = await this.find(collectionId, userId);
    if (!existing) throw new NotFoundError('Membership');
    const updated = { ...existing, role };
    this.rows.set(this.key(collectionId, userId), updated);
    return updated;
  }

  async remove(collectionId: string, userId: string): Promise<void> {
    this.rows.delete(this.key(collectionId, userId));
  }

  /** Test helper used when a collection is deleted. */
  removeAllFor(collectionId: string): void {
    for (const [key, row] of this.rows) {
      if (row.collectionId === collectionId) this.rows.delete(key);
    }
  }
}
