import { loginRequestSchema, registerRequestSchema } from '@trove/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createAuthController } from './auth.controller.js';
import { optionalAuth } from '../../http/middleware/authenticate.js';
import { createRateLimiter } from '../../http/middleware/rateLimit.js';
import { validate } from '../../http/middleware/validate.js';

export function createAuthRouter(container: Container): Router {
  const { env, services, repositories, tokens, oauth } = container;
  const controller = createAuthController({ auth: services.auth, env, google: oauth.google });

  // Brute-force protection on the credential endpoints. Relaxed under test so suites can exercise the routes.
  const credentialLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === 'test' ? 1_000 : 20,
  });

  const router = Router();
  router.post('/register', credentialLimiter, validate({ body: registerRequestSchema }), controller.register);
  router.post('/login', credentialLimiter, validate({ body: loginRequestSchema }), controller.login);
  router.post('/logout', controller.logout);
  // Visitors get { user: null } rather than a 401, so the client can probe the session quietly.
  router.get('/me', optionalAuth({ tokens, users: repositories.users }), controller.me);
  router.get('/providers', controller.providers);
  router.get('/google', credentialLimiter, controller.googleStart);
  router.get('/google/callback', credentialLimiter, controller.googleCallback);
  return router;
}
