import { markNotificationsReadRequestSchema } from '@trove/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createNotificationsController } from '../controllers/notifications.controller.js';
import { requireAuth } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

export function createNotificationsRouter(container: Container): Router {
  const controller = createNotificationsController(container.services.notifications);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router();
  router.get('/', signedIn, controller.inbox);
  router.post('/read', signedIn, validate({ body: markNotificationsReadRequestSchema }), controller.markRead);
  return router;
}
