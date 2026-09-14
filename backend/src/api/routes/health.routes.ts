import { Router } from 'express';

interface HealthDeps {
  version: string;
}

/**
 * Liveness endpoint. Reports version and uptime. Dependency checks (database,
 * image provider) are added here once those adapters exist.
 */
export function createHealthRouter({ version }: HealthDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
