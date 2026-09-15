import {
  messagesQuerySchema,
  sendMessageRequestSchema,
  startConversationRequestSchema,
} from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { requireAuth } from '../../http/middleware/authenticate.js';
import { idParams } from '../../http/params.js';
import { validate } from '../../http/middleware/validate.js';
import { createMessagingController } from './messaging.controller.js';

/** Everything here is private mail, so the whole router sits behind a session. */
export function createConversationsRouter(container: Container): Router {
  const controller = createMessagingController(container.services.messaging);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router();
  router.use(signedIn);
  router.get('/', controller.inbox);
  router.post('/', validate({ body: startConversationRequestSchema }), controller.start);
  router.get(
    '/:id/messages',
    validate({ params: idParams, query: messagesQuerySchema }),
    controller.messages,
  );
  router.post(
    '/:id/messages',
    validate({ params: idParams, body: sendMessageRequestSchema }),
    controller.send,
  );
  router.post('/:id/read', validate({ params: idParams }), controller.markRead);
  return router;
}
