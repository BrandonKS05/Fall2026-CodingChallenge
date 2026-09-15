import { eq, sql } from 'drizzle-orm';
import type { User } from '../../../domain/entities/User.js';
import { ConflictError, NotFoundError } from '../../../domain/errors/index.js';
import type { NewUser, UserPatch, UserRepository } from '../ports/UserRepository.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { isUniqueViolation } from '../../../infrastructure/db/errors.js';
import { users } from '../../../infrastructure/db/schema/index.js';

type UserRow = typeof users.$inferSelect;

/** Row-to-entity mapping lives here so the domain never sees Drizzle types. */
const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  passwordHash: row.passwordHash,
  googleId: row.googleId,
  bio: row.bio,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    return row ? toUser(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.googleId, googleId) });
    return row ? toUser(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    try {
      const [row] = await this.db
        .insert(users)
        .values({ ...input, googleId: input.googleId ?? null })
        .returning();
      if (!row) throw new Error('Insert returned no row');
      return toUser(row);
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new ConflictError('An account with this email already exists');
      }
      if (isUniqueViolation(error, 'users_google_id_unique')) {
        throw new ConflictError('That Google account is already linked to a user');
      }
      throw error;
    }
  }

  async linkGoogle(userId: string, googleId: string): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ googleId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new NotFoundError('User', userId);
    return toUser(row);
  }

  async update(userId: string, patch: UserPatch): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new NotFoundError('User', userId);
    return toUser(row);
  }

  /** Foreign keys cascade, so everything the person owned or added disappears with them. */
  async delete(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
