/** Presenters turn domain objects into the shapes promised by @trove/shared. */
import type { AuthResponse, User as UserDto } from '@trove/shared';
import type { PublicUser } from '../../domain/entities/User.js';

export function presentUser(user: PublicUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export function presentAuth(user: PublicUser): AuthResponse {
  return { user: presentUser(user) };
}
