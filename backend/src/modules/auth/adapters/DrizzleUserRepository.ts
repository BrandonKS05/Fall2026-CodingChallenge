import { parsePreferences, type UserPreferences } from '@wumboo/shared';
import { eq, inArray, sql } from 'drizzle-orm';
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
  preferences: parsePreferences(row.preferences),
  sessionVersion: row.sessionVersion,
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

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    const [row] = await this.db
      .update(users)
      .set({ passwordHash, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (!row) throw new NotFoundError('User', userId);
  }

  async bumpSessionVersion(userId: string): Promise<number> {
    const [row] = await this.db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: sql`now()` })
      .where(eq(users.id, userId))
      .returning({ sessionVersion: users.sessionVersion });
    if (!row) throw new NotFoundError('User', userId);
    return row.sessionVersion;
  }

  async findPreferences(userIds: string[]): Promise<Map<string, UserPreferences>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: users.id, preferences: users.preferences })
      .from(users)
      .where(inArray(users.id, userIds));
    return new Map(rows.map((row) => [row.id, parsePreferences(row.preferences)]));
  }

  /** Foreign keys cascade, so everything the person owned or added disappears with them. */
  async delete(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
