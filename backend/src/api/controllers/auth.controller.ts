/**
 * Auth controller. Controllers are thin: read validated input, call one
 * service method, present the result. No business rules live here.
 */
import type { LoginRequest, RegisterRequest } from '@trove/shared';
import type { RequestHandler } from 'express';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../../services/AuthService.js';
import { clearSessionCookie, setSessionCookie } from '../http/session.js';
import { currentUser } from '../middleware/authenticate.js';
import { getValidated } from '../middleware/validate.js';
import { presentAuth } from '../presenters/user.presenter.js';

export interface AuthControllerDeps {
  auth: AuthService;
  env: Pick<Env, 'NODE_ENV'>;
}

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
}

export function createAuthController({ auth, env }: AuthControllerDeps): AuthController {
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
      res.json(presentAuth(currentUser(res)));
    },
  };
}
