import { randomUUID } from 'node:crypto';
import type { User } from '../../domain/entities/User.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type { NewUser, UserRepository } from '../../modules/auth/ports/UserRepository.js';

/** Port-conformant fake. Mirrors the real repository's contract, including the ConflictError. */
export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.email === email) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.googleId === googleId) ?? null;
  }

  async create(input: NewUser): Promise<User> {
    if (await this.findByEmail(input.email)) {
      throw new ConflictError('An account with this email already exists');
    }
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      googleId: input.googleId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(user.id, user);
    return user;
  }

  async linkGoogle(userId: string, googleId: string): Promise<User> {
    const existing = this.rows.get(userId);
    if (!existing) throw new NotFoundError('User', userId);
    const updated = { ...existing, googleId, updatedAt: new Date() };
    this.rows.set(userId, updated);
    return updated;
  }

  /** Test helper: simulate an account being removed while a session is live. */
  delete(id: string): void {
    this.rows.delete(id);
  }
}
