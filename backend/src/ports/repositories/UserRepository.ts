import type { User } from '../../domain/entities/User.js';

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Throws ConflictError when the email is already registered. */
  create(input: NewUser): Promise<User>;
}
