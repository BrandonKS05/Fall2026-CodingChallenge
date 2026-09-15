import {
  followListQuerySchema,
  handleParamsSchema,
  profileSearchQuerySchema,
} from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { optionalAuth, requireAuth } from '../../http/middleware/authenticate.js';
import { validate } from '../../http/middleware/validate.js';
import { createSocialController } from './social.controller.js';

/** Profiles are public; following is not, so only the two writes need a session. */
export function createUsersRouter(container: Container): Router {
  const controller = createSocialController(container.services.social);
  const deps = { tokens: container.tokens, users: container.repositories.users };
  const maybeSignedIn = optionalAuth(deps);
  const signedIn = requireAuth(deps);

  const router = Router();
  // Before the handle route, which would otherwise answer for a user called "search".
  router.get(
    '/search',
    maybeSignedIn,
    validate({ query: profileSearchQuerySchema }),
    controller.search,
  );
  router.get(
    '/:handle',
    maybeSignedIn,
    validate({ params: handleParamsSchema }),
    controller.profile,
  );
  router.get(
    '/:handle/followers',
    maybeSignedIn,
    validate({ params: handleParamsSchema, query: followListQuerySchema }),
    controller.followers,
  );
  router.get(
    '/:handle/following',
    maybeSignedIn,
    validate({ params: handleParamsSchema, query: followListQuerySchema }),
    controller.following,
  );
  router.post(
    '/:handle/follow',
    signedIn,
    validate({ params: handleParamsSchema }),
    controller.follow,
  );
  router.delete(
    '/:handle/follow',
    signedIn,
    validate({ params: handleParamsSchema }),
    controller.unfollow,
  );
  return router;
}
