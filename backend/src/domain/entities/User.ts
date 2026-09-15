export interface User {
  id: string;
  email: string;
  displayName: string;
  /** Null for accounts that only sign in through an identity provider. */
  passwordHash: string | null;
  /** Google's stable subject id, once the account has signed in with Google. */
  googleId: string | null;
  /** Shown on the person's own page; empty until written. */
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A user as seen outside the auth boundary: never carries the password hash. */
export type PublicUser = Omit<User, 'passwordHash' | 'googleId'>;

/** Explicit allow-list so a new sensitive column can never leak by accident. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
