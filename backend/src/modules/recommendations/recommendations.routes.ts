import {
  chooseInterestsRequestSchema,
  recommendationsQuerySchema,
  recordInteractionRequestSchema,
} from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { requireAuth } from '../../http/middleware/authenticate.js';
import { validate } from '../../http/middleware/validate.js';
import { createRecommendationsController } from './recommendations.controller.js';

/**
 * A feed is personal, so every route here needs a session. A signed-out
 * visitor gets Explore, which is the same pictures without the opinion.
 */
export function createRecommendationsRouter(container: Container): Router {
  const controller = createRecommendationsController(
    container.services.recommendations,
    container.services.interests,
  );
  const signedIn = requireAuth({
    tokens: container.tokens,
    users: container.repositories.users,
  });

  const router = Router();
  router.get('/', signedIn, validate({ query: recommendationsQuerySchema }), controller.feed);
  router.post(
    '/interactions',
    signedIn,
    validate({ body: recordInteractionRequestSchema }),
    controller.record,
  );
  router.post(
    '/interests',
    signedIn,
    validate({ body: chooseInterestsRequestSchema }),
    controller.chooseInterests,
  );
  return router;
}
