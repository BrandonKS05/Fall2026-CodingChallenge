import { Router } from 'express';
import type { Container } from '../../container.js';

/**
 * One relative path for the chat, so the browser only ever talks to this
 * origin and the assistant can move hosts without a frontend rebuild.
 */
export function createAssistantRouter(container: Container): Router {
  const router = Router();
  router.post('/', async (req, res) => {
    const sessionId = req.get('x-session-id');
    const reply = await container.assistant.ask({
      body: req.body,
      sessionId: sessionId === null ? undefined : sessionId,
    });
    if (reply.retryAfterSeconds !== undefined) {
      res.set('retry-after', String(reply.retryAfterSeconds));
    }
    res.status(reply.status).json(reply.body);
  });
  return router;
}
