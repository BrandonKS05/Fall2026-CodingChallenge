import { createItemRequestSchema, updateItemRequestSchema } from '@trove/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createItemsController } from './items.controller.js';
import { collectionItemParams, idParams } from '../../http/params.js';
import { requireAuth } from '../../http/middleware/authenticate.js';
import { validate } from '../../http/middleware/validate.js';

/** Mounted at /collections/:id/items. mergeParams exposes the board id from the parent path. */
export function createItemsRouter(container: Container): Router {
  const controller = createItemsController(container.services.items);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router({ mergeParams: true });
  router.post(
    '/',
    signedIn,
    validate({ params: idParams, body: createItemRequestSchema }),
    controller.add,
  );
  router.patch(
    '/:itemId',
    signedIn,
    validate({ params: collectionItemParams, body: updateItemRequestSchema }),
    controller.update,
  );
  router.delete(
    '/:itemId',
    signedIn,
    validate({ params: collectionItemParams }),
    controller.remove,
  );
  return router;
}
