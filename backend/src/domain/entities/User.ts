import type { UserPreferences } from '@wumboo/shared';

export interface User {
  id: string;
  /** Null for an account that signed up by phone and has given no address. */
  email: string | null;
  /** When the address was proved by a code; null while it is only claimed. */
  emailVerifiedAt: Date | null;
  /** E.164, null unless a number was given. */
  phone: string | null;
  phoneVerifiedAt: Date | null;
  displayName: string;
  /** Null for accounts that only sign in through an identity provider. */
  passwordHash: string | null;
  /** Google's stable subject id, once the account has signed in with Google. */
  googleId: string | null;
  /** Unique, lowercase, and slow to change: how other people find this account. */
  handle: string;
  /** When the handle last changed; null while it is the one chosen at sign-up. */
  handleChangedAt: Date | null;
  /** Shown on the person's own page; empty until written. */
  bio: string;
  /** The account's own settings, always complete: stored gaps are filled with defaults. */
  preferences: UserPreferences;
  /** Every token carries this; raising it retires the tokens already out there. */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

/** A user as seen outside the auth boundary: never carries the password hash. */
export type PublicUser = Omit<User, 'passwordHash' | 'googleId' | 'sessionVersion'>;

/** Explicit allow-list so a new sensitive column can never leak by accident. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt,
    displayName: user.displayName,
    handle: user.handle,
    handleChangedAt: user.handleChangedAt,
    bio: user.bio,
    preferences: user.preferences,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
