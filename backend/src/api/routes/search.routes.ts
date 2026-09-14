import { searchQuerySchema } from '@trove/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createSearchController } from '../controllers/search.controller.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

/** Discovery is open to visitors; the per-client limit protects the shared provider quota. */
export function createSearchRouter(container: Container): Router {
  const controller = createSearchController(container.services.images);
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    limit: container.env.NODE_ENV === 'test' ? 1_000 : 30,
  });

  const router = Router();
  router.get('/', limiter, validate({ query: searchQuerySchema }), controller.search);
  return router;
}
