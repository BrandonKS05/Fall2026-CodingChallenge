import { eq } from 'drizzle-orm';
import type { User } from '../../../domain/entities/User.js';
import { ConflictError } from '../../../domain/errors/index.js';
import type { NewUser, UserRepository } from '../../../ports/repositories/UserRepository.js';
import type { Db } from '../client.js';
import { isUniqueViolation } from '../errors.js';
import { users } from '../schema/index.js';

type UserRow = typeof users.$inferSelect;

/** Row-to-entity mapping lives here so the domain never sees Drizzle types. */
const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  passwordHash: row.passwordHash,
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

  async create(input: NewUser): Promise<User> {
    try {
      const [row] = await this.db.insert(users).values(input).returning();
      if (!row) throw new Error('Insert returned no row');
      return toUser(row);
    } catch (error) {
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw new ConflictError('An account with this email already exists');
      }
      throw error;
    }
  }
}
