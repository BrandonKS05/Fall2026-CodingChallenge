import { Router } from 'express';
import type { Container } from '../../container.js';
import { createAuthRouter } from './auth.routes.js';
import { createCollectionsRouter, createExploreRouter } from './collections.routes.js';
import { createHealthRouter } from './health.routes.js';

/** Mounts every resource router under /api. Feature routers are added here as they land. */
export function createApiRouter(container: Container): Router {
  const api = Router();

  api.use(
    '/health',
    createHealthRouter({ version: container.version, indicators: container.healthIndicators }),
  );
  api.use('/auth', createAuthRouter(container));
  api.use('/collections', createCollectionsRouter(container));
  api.use('/explore', createExploreRouter(container));

  return api;
}
