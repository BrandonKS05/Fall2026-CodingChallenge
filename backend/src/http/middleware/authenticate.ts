/**
 * Session middleware. Reads the session cookie, verifies the token, loads the
 * user, and exposes it to controllers through currentUser(). Loading the user
 * on every request costs one indexed query and guarantees deleted accounts
 * lose access immediately.
 */
import type { RequestHandler, Response } from 'express';
import { SESSION_COOKIE_NAME } from '../../config/session.js';
import { toPublicUser, type PublicUser } from '../../domain/entities/User.js';
import type { UserRepository } from '../../modules/auth/ports/UserRepository.js';
import type { TokenService } from '../../modules/auth/ports/TokenService.js';
import { ApiError } from '../ApiError.js';

export interface AuthenticateDeps {
  tokens: TokenService;
  users: UserRepository;
}

function authenticate(deps: AuthenticateDeps, options: { required: boolean }): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    const claims = typeof token === 'string' && token ? await deps.tokens.verify(token) : null;
    const user = claims ? await deps.users.findById(claims.userId) : null;

    if (!user) {
      if (options.required) {
        next(ApiError.unauthorized());
      } else {
        next();
      }
      return;
    }

    res.locals.user = toPublicUser(user);
    next();
  };
}

/** Rejects anonymous requests with 401. */
export const requireAuth = (deps: AuthenticateDeps): RequestHandler =>
  authenticate(deps, { required: true });

/** Attaches the user when a valid session exists, otherwise continues anonymously. */
export const optionalAuth = (deps: AuthenticateDeps): RequestHandler =>
  authenticate(deps, { required: false });

/** The authenticated user. Only valid behind requireAuth. */
export function currentUser(res: Response): PublicUser {
  const user = res.locals.user as PublicUser | undefined;
  if (!user) throw ApiError.internal('currentUser() used on a route without requireAuth');
  return user;
}

/** The authenticated user if any. Valid behind optionalAuth. */
export function optionalUser(res: Response): PublicUser | null {
  return (res.locals.user as PublicUser | undefined) ?? null;
}
