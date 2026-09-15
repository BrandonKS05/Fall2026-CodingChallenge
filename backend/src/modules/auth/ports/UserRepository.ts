import type { User } from '../../../domain/entities/User.js';

export interface NewUser {
  email: string;
  displayName: string;
  /** Null for identity-provider-only accounts. */
  passwordHash: string | null;
  googleId?: string | null;
}

/** What a person may change about themselves. */
export type UserPatch = Partial<Pick<User, 'displayName' | 'bio'>>;

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  /** Throws ConflictError when the email is already registered. */
  create(input: NewUser): Promise<User>;
  /** Attaches a Google identity to an existing account. Throws NotFoundError for an unknown id. */
  linkGoogle(userId: string, googleId: string): Promise<User>;
  /** Throws NotFoundError for an unknown id. */
  update(userId: string, patch: UserPatch): Promise<User>;
  /** Removes the account; boards, memberships, saves, likes, and notifications go with it. */
  delete(userId: string): Promise<void>;
}
