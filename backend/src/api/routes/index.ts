import { Router } from 'express';
import type { Container } from '../../container.js';
import { createHealthRouter } from './health.routes.js';

/** Mounts every resource router under /api. Feature routers are added here as they land. */
export function createApiRouter(container: Container): Router {
  const api = Router();

  api.use('/health', createHealthRouter({ version: container.version }));

  return api;
}
