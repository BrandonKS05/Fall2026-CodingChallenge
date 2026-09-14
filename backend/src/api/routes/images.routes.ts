import { Router } from 'express';
import type { Container } from '../../container.js';
import { createImagesController } from '../controllers/images.controller.js';
import { idParams } from '../http/params.js';
import { validate } from '../middleware/validate.js';

/** Stored image files. Ids are unguessable UUIDs, and anything shared publicly needs them, so no auth. */
export function createImagesRouter(container: Container): Router {
  const controller = createImagesController(container.services.images);
  const router = Router();
  router.get('/:id', validate({ params: idParams }), controller.serve);
  return router;
}
