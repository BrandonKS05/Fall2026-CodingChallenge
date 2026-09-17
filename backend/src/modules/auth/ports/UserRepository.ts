import type { UserPreferences } from '@wumboo/shared';
import type { User } from '../../../domain/entities/User.js';

export interface NewUser {
  /** One of email or phone is always present: an account has to be reachable somehow. */
  email?: string | null;
  /** Set when the address arrived already proved, as it does from Google. */
  emailVerifiedAt?: Date | null;
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
  displayName: string;
  /** Null for identity-provider-only accounts. */
  passwordHash: string | null;
  /**
   * The handle the person chose. A taken one is a ConflictError. Absent for
   * accounts arriving from Google: the repository then derives a free one.
   */
  handle?: string;
  googleId?: string | null;
}

/** What a person may change about themselves. */
export type UserPatch = Partial<
  Pick<User, 'displayName' | 'bio' | 'preferences' | 'handle' | 'handleChangedAt'>
>;

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByHandle(handle: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  /** Throws ConflictError when the email is already registered. */
  create(input: NewUser): Promise<User>;
  /** Attaches a Google identity to an existing account. Throws NotFoundError for an unknown id. */
  linkGoogle(userId: string, googleId: string): Promise<User>;
  /** Throws NotFoundError for an unknown id. */
  update(userId: string, patch: UserPatch): Promise<User>;
  /** Stamps the moment an address or a number was proved by a code. */
  markVerified(
    userId: string,
    patch: { emailVerifiedAt?: Date; phoneVerifiedAt?: Date },
  ): Promise<User>;
  /** Replaces the stored password hash. Throws NotFoundError for an unknown id. */
  setPassword(userId: string, passwordHash: string): Promise<void>;
  /** Retires every token issued so far and resolves the new version. */
  bumpSessionVersion(userId: string): Promise<number>;
  /** Preferences for several people at once, for fan-out decisions. Unknown ids are absent. */
  findPreferences(userIds: string[]): Promise<Map<string, UserPreferences>>;
  /** Removes the account; boards, memberships, saves, likes, and notifications go with it. */
  delete(userId: string): Promise<void>;
}
