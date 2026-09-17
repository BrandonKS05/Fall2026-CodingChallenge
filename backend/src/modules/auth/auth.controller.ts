/**
 * Auth controller. Controllers are thin: read validated input, call one
 * service method, present the result. No business rules live here.
 */
import { randomBytes } from 'node:crypto';
import type {
  AuthProvidersResponse,
  ChangePasswordRequest,
  HandleAvailabilityQuery,
  HandleAvailabilityResponse,
  LoginRequest,
  RegisterRequest,
  SendCodeRequest,
  VerifyCodeRequest,
  UpdateProfileRequest,
} from '@wumboo/shared';
import type { RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { OAuthProvider } from './ports/OAuthProvider.js';
import type { AccountExportService } from './AccountExportService.js';
import type { AuthOutcome, AuthService } from './AuthService.js';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  OAUTH_STATE_COOKIE_NAME,
  setOAuthStateCookie,
  setSessionCookie,
} from '../../http/session.js';
import { currentUser, optionalUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentOutcome, presentSession, presentUser } from './user.presenter.js';

export interface AuthControllerDeps {
  auth: AuthService;
  accountExport: AccountExportService;
  env: Pick<Env, 'NODE_ENV' | 'APP_URL'>;
  google?: OAuthProvider | undefined;
}

export interface AuthController {
  handleAvailability: RequestHandler;
  sendCode: RequestHandler;
  verifyCode: RequestHandler;
  exportAccount: RequestHandler;
  changePassword: RequestHandler;
  revokeSessions: RequestHandler;
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

export function createAuthController({
  auth,
  accountExport,
  env,
  google,
}: AuthControllerDeps): AuthController {
  const redirectUri = `${env.APP_URL}/api/auth/google/callback`;
  /** The one place a session cookie is attached: wherever an outcome carries a token. */
  const answer = (res: Response, outcome: AuthOutcome, status = 200): void => {
    if (outcome.status === 'signed-in') setSessionCookie(res, outcome.token, env);
    res.status(status).json(presentOutcome(outcome));
  };
  const backToLogin = (reason: string) => `${env.APP_URL}/login?error=${reason}`;

  return {
    register: async (_req, res) => {
      const { body } = getValidated<RegisterRequest>(res);
      // 201 only when an account is really open; a code still to be typed is a 202.
      const outcome = await auth.register(body);
      answer(res, outcome, outcome.status === 'signed-in' ? 201 : 202);
    },

    login: async (_req, res) => {
      const { body } = getValidated<LoginRequest>(res);
      answer(res, await auth.login(body));
    },

    sendCode: async (_req, res) => {
      const { body } = getValidated<SendCodeRequest>(res);
      answer(res, await auth.sendCode(body.email), 202);
    },

    verifyCode: async (_req, res) => {
      const { body } = getValidated<VerifyCodeRequest>(res);
      answer(res, await auth.verifyCode({ target: body.email, code: body.code }));
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

    /** The whole account as a file, so leaving is never a matter of copying screens. */
    exportAccount: async (_req, res) => {
      const user = currentUser(res);
      const data = await accountExport.export(user.id);
      const day = new Date().toISOString().slice(0, 10);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="wumboo-${user.handle}-${day}.json"`,
      );
      res.json(data);
    },

    /** The new password re-issues this session's cookie; the other devices lose theirs. */
    changePassword: async (_req, res) => {
      const { body } = getValidated<ChangePasswordRequest>(res);
      const token = await auth.changePassword(currentUser(res).id, body);
      setSessionCookie(res, token, env);
      res.status(204).end();
    },

    /** Signs out everywhere else, keeping the caller signed in here. */
    revokeSessions: async (_req, res) => {
      const token = await auth.revokeOtherSessions(currentUser(res).id);
      setSessionCookie(res, token, env);
      res.status(204).end();
    },

    /** The account is gone, so the session cookie goes with it. */
    deleteAccount: async (_req, res) => {
      await auth.deleteAccount(currentUser(res).id);
      clearSessionCookie(res, env);
      res.status(204).end();
    },

    handleAvailability: async (_req, res) => {
      const { query } = getValidated<unknown, HandleAvailabilityQuery>(res);
      const body: HandleAvailabilityResponse = {
        handle: query.handle,
        available: await auth.isHandleAvailable(query.handle),
      };
      res.json(body);
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
