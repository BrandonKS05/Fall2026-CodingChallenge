/**
 * Auth controller. Controllers are thin: read validated input, call one
 * service method, present the result. No business rules live here.
 */
import { randomBytes } from 'node:crypto';
import type {
  AuthProvidersResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from '@wumboo/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { OAuthProvider } from './ports/OAuthProvider.js';
import type { AuthService } from './AuthService.js';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  OAUTH_STATE_COOKIE_NAME,
  setOAuthStateCookie,
  setSessionCookie,
} from '../../http/session.js';
import { currentUser, optionalUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentAuth, presentSession, presentUser } from './user.presenter.js';

export interface AuthControllerDeps {
  auth: AuthService;
  env: Pick<Env, 'NODE_ENV' | 'APP_URL'>;
  google?: OAuthProvider | undefined;
}

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  updateProfile: RequestHandler;
  deleteAccount: RequestHandler;
  providers: RequestHandler;
  googleStart: RequestHandler;
  googleCallback: RequestHandler;
}

/** Google's callback query. Everything is optional because a denied consent has only `error`. */
const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export function createAuthController({ auth, env, google }: AuthControllerDeps): AuthController {
  const redirectUri = `${env.APP_URL}/api/auth/google/callback`;
  const backToLogin = (reason: string) => `${env.APP_URL}/login?error=${reason}`;

  return {
    register: async (_req, res) => {
      const { body } = getValidated<RegisterRequest>(res);
      const result = await auth.register(body);
      setSessionCookie(res, result.token, env);
      res.status(201).json(presentAuth(result.user));
    },

    login: async (_req, res) => {
      const { body } = getValidated<LoginRequest>(res);
      const result = await auth.login(body);
      setSessionCookie(res, result.token, env);
      res.json(presentAuth(result.user));
    },

    logout: (_req, res) => {
      clearSessionCookie(res, env);
      res.status(204).end();
    },

    me: (_req, res) => {
      res.json(presentSession(optionalUser(res)));
    },

    updateProfile: async (_req, res) => {
      const { body } = getValidated<UpdateProfileRequest>(res);
      res.json(presentUser(await auth.updateProfile(currentUser(res).id, body)));
    },

    /** The account is gone, so the session cookie goes with it. */
    deleteAccount: async (_req, res) => {
      await auth.deleteAccount(currentUser(res).id);
      clearSessionCookie(res, env);
      res.status(204).end();
    },

    providers: (_req, res) => {
      const body: AuthProvidersResponse = { google: google !== undefined };
      res.json(body);
    },

    /** Step 1: remember a random state in a cookie and send the browser to Google. */
    googleStart: (_req, res) => {
      if (!google) {
        res.redirect(backToLogin('google_unavailable'));
        return;
      }
      const state = randomBytes(16).toString('base64url');
      setOAuthStateCookie(res, state, env);
      res.redirect(google.authorizationUrl({ state, redirectUri }));
    },

    /** Step 2: Google sends the browser back with a code; trade it for a profile and start a session. */
    googleCallback: async (req, res) => {
      const expectedState: unknown = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
      clearOAuthStateCookie(res, env);

      const query = callbackQuerySchema.safeParse(req.query);
      if (!google || !query.success) {
        res.redirect(backToLogin('google_failed'));
        return;
      }
      if (query.data.error) {
        res.redirect(backToLogin('google_denied'));
        return;
      }
      if (!query.data.code || !query.data.state || query.data.state !== expectedState) {
        res.redirect(backToLogin('oauth_state'));
        return;
      }

      try {
        const profile = await google.exchangeCode({ code: query.data.code, redirectUri });
        const result = await auth.loginWithOAuth(profile);
        setSessionCookie(res, result.token, env);
        res.redirect(`${env.APP_URL}/boards`);
      } catch {
        // The browser is mid-redirect; a JSON envelope would be unreadable here.
        res.redirect(backToLogin('google_failed'));
      }
    },
  };
}
