import {
  createCollectionRequestSchema,
  paginationQuerySchema,
  updateCollectionRequestSchema,
} from '@trove/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createCollectionsController } from '../controllers/collections.controller.js';
import { idParams } from '../http/params.js';
import { optionalAuth, requireAuth } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

export function createCollectionsRouter(container: Container): Router {
  const controller = createCollectionsController(container.services.collections);
  const authDeps = { tokens: container.tokens, users: container.repositories.users };
  const signedIn = requireAuth(authDeps);
  const maybeSignedIn = optionalAuth(authDeps);

  const router = Router();
  router.get('/', signedIn, controller.list);
  router.post('/', signedIn, validate({ body: createCollectionRequestSchema }), controller.create);
  // Viewing is open to non-members for unlisted and public boards, so auth is optional here.
  router.get('/:id', maybeSignedIn, validate({ params: idParams }), controller.get);
  router.patch(
    '/:id',
    signedIn,
    validate({ params: idParams, body: updateCollectionRequestSchema }),
    controller.update,
  );
  router.delete('/:id', signedIn, validate({ params: idParams }), controller.remove);
  return router;
}

/** Public boards. Mounted at /explore. */
export function createExploreRouter(container: Container): Router {
  const controller = createCollectionsController(container.services.collections);
  const maybeSignedIn = optionalAuth({
    tokens: container.tokens,
    users: container.repositories.users,
  });

  const router = Router();
  router.get('/', maybeSignedIn, validate({ query: paginationQuerySchema }), controller.explore);
  return router;
}
