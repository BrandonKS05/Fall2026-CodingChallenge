/** Presenters turn domain objects into the shapes promised by @wumboo/shared. */
import type { AuthResponse, SessionResponse, User as UserDto } from '@wumboo/shared';
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

export function presentSession(user: PublicUser | null): SessionResponse {
  return { user: user ? presentUser(user) : null };
}
