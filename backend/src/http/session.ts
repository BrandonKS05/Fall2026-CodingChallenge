import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '../config/session.js';

/**
 * httpOnly keeps the token away from scripts; Lax works because the frontend
 * reaches the API through a same-site /api proxy in every environment.
 */
function baseOptions(env: Pick<Env, 'NODE_ENV'>): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, env: Pick<Env, 'NODE_ENV'>): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...baseOptions(env),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response, env: Pick<Env, 'NODE_ENV'>): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions(env));
}

/** Ties the callback to the browser that started the sign-in; ten minutes is plenty for a consent screen. */
export const OAUTH_STATE_COOKIE_NAME = 'wumboo_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function setOAuthStateCookie(
  res: Response,
  state: string,
  env: Pick<Env, 'NODE_ENV'>,
): void {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    ...baseOptions(env),
    path: '/api/auth',
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

export function clearOAuthStateCookie(res: Response, env: Pick<Env, 'NODE_ENV'>): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, { ...baseOptions(env), path: '/api/auth' });
}
