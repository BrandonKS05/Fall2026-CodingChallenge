/** Presenters turn domain objects into the shapes promised by @wumboo/shared. */
import type {
  AuthOutcome as AuthOutcomeDto,
  SessionResponse,
  User as UserDto,
} from '@wumboo/shared';
import type { AuthOutcome } from './AuthService.js';
import type { PublicUser } from '../../domain/entities/User.js';

export function presentUser(user: PublicUser): UserDto {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    displayName: user.displayName,
    handle: user.handle,
    handleChangedAt: user.handleChangedAt?.toISOString() ?? null,
    bio: user.bio,
    preferences: user.preferences,
    createdAt: user.createdAt.toISOString(),
  };
}

/** The outcome of a sign-in attempt, minus the token, which rides in a cookie. */
export function presentOutcome(outcome: AuthOutcome): AuthOutcomeDto {
  return outcome.status === 'signed-in'
    ? { status: 'signed-in', user: presentUser(outcome.user) }
    : outcome;
}

export function presentSession(user: PublicUser | null): SessionResponse {
  return { user: user ? presentUser(user) : null };
}
