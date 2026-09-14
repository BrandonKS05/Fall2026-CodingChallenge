export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A user as seen outside the auth boundary: never carries the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

/** Explicit allow-list so a new sensitive column can never leak by accident. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
