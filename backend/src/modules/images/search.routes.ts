import { searchQuerySchema } from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createSearchController } from './search.controller.js';
import { optionalAuth } from '../../http/middleware/authenticate.js';
import { createRateLimiter } from '../../http/middleware/rateLimit.js';
import { validate } from '../../http/middleware/validate.js';

/** Discovery is open to visitors; the per-client limit protects the shared provider quota. */
export function createSearchRouter(container: Container): Router {
  const controller = createSearchController(container.services.images);
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: container.env.NODE_ENV === 'test' ? 1_000 : 30,
  });

  // Signed in or not, the search works; a session only adds the muted tags to leave out.
  const maybeSignedIn = optionalAuth({
    tokens: container.tokens,
    users: container.repositories.users,
  });

  const router = Router();
  // The browse grid's covers: stored images, so no provider call and no limiter.
  router.get('/categories', controller.categories);
  router.get(
    '/',
    limiter,
    maybeSignedIn,
    validate({ query: searchQuerySchema }),
    controller.search,
  );
  return router;
}
