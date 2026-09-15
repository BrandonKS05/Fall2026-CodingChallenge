import { randomUUID } from 'node:crypto';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '@wumboo/shared';
import type { User } from '../../domain/entities/User.js';
import { ConflictError, NotFoundError } from '../../domain/errors/index.js';
import type {
  NewUser,
  UserPatch,
  UserRepository,
} from '../../modules/auth/ports/UserRepository.js';

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
      bio: '',
      preferences: DEFAULT_USER_PREFERENCES,
      sessionVersion: 0,
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

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    const existing = this.rows.get(userId);
    if (!existing) throw new NotFoundError('User', userId);
    this.rows.set(userId, { ...existing, passwordHash, updatedAt: new Date() });
  }

  async bumpSessionVersion(userId: string): Promise<number> {
    const existing = this.rows.get(userId);
    if (!existing) throw new NotFoundError('User', userId);
    const sessionVersion = existing.sessionVersion + 1;
    this.rows.set(userId, { ...existing, sessionVersion, updatedAt: new Date() });
    return sessionVersion;
  }

  async findPreferences(userIds: string[]): Promise<Map<string, UserPreferences>> {
    const found = userIds.flatMap((userId) => {
      const user = this.rows.get(userId);
      return user ? [[userId, user.preferences] as const] : [];
    });
    return new Map(found);
  }

  /** Test helper: simulate an account being removed while a session is live. */
  async delete(userId: string): Promise<void> {
    this.rows.delete(userId);
  }

  async update(userId: string, patch: UserPatch): Promise<User> {
    const existing = this.rows.get(userId);
    if (!existing) throw new NotFoundError('User', userId);
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const updated = { ...existing, ...defined, updatedAt: new Date() };
    this.rows.set(userId, updated);
    return updated;
  }
}
