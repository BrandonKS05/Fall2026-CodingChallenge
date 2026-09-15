import { landingImagesQuerySchema } from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createImagesController } from './images.controller.js';
import { idParams } from '../../http/params.js';
import { validate } from '../../http/middleware/validate.js';

/** Stored image files. Ids are unguessable UUIDs, and anything shared publicly needs them, so no auth. */
export function createImagesRouter(container: Container): Router {
  const controller = createImagesController(container.services.images);
  const router = Router();
  router.get('/:id', validate({ params: idParams }), controller.serve);
  return router;
}

/**
 * The landing stage's feed. Its own router, because it is a fixed curation with
 * no relationship to boards: nothing anyone saves or publishes reaches it.
 */
export function createLandingRouter(container: Container): Router {
  const controller = createImagesController(container.services.images);
  const router = Router();
  router.get('/images', validate({ query: landingImagesQuerySchema }), controller.landing);
  return router;
}
