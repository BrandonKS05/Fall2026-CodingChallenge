import type { User } from '../../domain/entities/User.js';

export interface NewUser {
  email: string;
  displayName: string;
  /** Null for identity-provider-only accounts. */
  passwordHash: string | null;
  googleId?: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  /** Throws ConflictError when the email is already registered. */
  create(input: NewUser): Promise<User>;
  /** Attaches a Google identity to an existing account. Throws NotFoundError for an unknown id. */
  linkGoogle(userId: string, googleId: string): Promise<User>;
}
