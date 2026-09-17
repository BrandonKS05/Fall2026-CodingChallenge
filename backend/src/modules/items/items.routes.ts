import {
  createItemRequestSchema,
  savedItemsQuerySchema,
  updateItemRequestSchema,
  uploadItemQuerySchema,
} from '@wumboo/shared';
import express, { Router } from 'express';
import type { Container } from '../../container.js';
import { createItemsController } from './items.controller.js';
import { collectionItemParams, idParams } from '../../http/params.js';
import { requireAuth } from '../../http/middleware/authenticate.js';
import { validate } from '../../http/middleware/validate.js';

/** What a browser will send from a file picker, and all we are willing to store. */
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Mounted at /collections/:id/items. mergeParams exposes the board id from the parent path. */
export function createItemsRouter(container: Container): Router {
  const controller = createItemsController(container.services.items);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router({ mergeParams: true });
  /**
   * An upload is the file itself, with its own content type, rather than a
   * multipart envelope carrying one file: there is only ever one, so the
   * envelope would be packaging and a dependency for nothing.
   */
  router.post(
    '/upload',
    signedIn,
    express.raw({ type: UPLOAD_TYPES, limit: '8mb' }),
    validate({ params: idParams, query: uploadItemQuerySchema }),
    controller.upload,
  );
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

/** Mounted at /items: the signed-in person's saves across every board they belong to. */
export function createSavedItemsRouter(container: Container): Router {
  const controller = createItemsController(container.services.items);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router();
  router.get('/', signedIn, validate({ query: savedItemsQuerySchema }), controller.listMine);
  return router;
}
