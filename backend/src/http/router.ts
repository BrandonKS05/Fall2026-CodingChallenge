import { Router } from 'express';
import type { Container } from '../container.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import {
  createCollectionsRouter,
  createExploreRouter,
} from '../modules/collections/collections.routes.js';
import { createHealthRouter } from '../modules/health/health.routes.js';
import { createImagesRouter, createLandingRouter } from '../modules/images/images.routes.js';
import { createConversationsRouter } from '../modules/messaging/messaging.routes.js';
import { createSavedItemsRouter } from '../modules/items/items.routes.js';
import { createNotificationsRouter } from '../modules/notifications/notifications.routes.js';
import { createSearchRouter } from '../modules/images/search.routes.js';
import { createSharedRouter } from '../modules/sharing/share.routes.js';

/** Mounts every resource router under /api. */
export function createApiRouter(container: Container): Router {
  const api = Router();

  api.use(
    '/health',
    createHealthRouter({ version: container.version, indicators: container.healthIndicators }),
  );
  api.use('/auth', createAuthRouter(container));
  api.use('/collections', createCollectionsRouter(container));
  api.use('/explore', createExploreRouter(container));
  api.use('/shared', createSharedRouter(container));
  api.use('/search', createSearchRouter(container));
  api.use('/images', createImagesRouter(container));
  api.use('/landing', createLandingRouter(container));
  api.use('/items', createSavedItemsRouter(container));
  api.use('/notifications', createNotificationsRouter(container));
  api.use('/conversations', createConversationsRouter(container));

  return api;
}
