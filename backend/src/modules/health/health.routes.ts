import { Router } from 'express';
import type { HealthCheckResult, HealthIndicator } from './HealthIndicator.js';

interface HealthDeps {
  version: string;
  indicators: HealthIndicator[];
}

/**
 * Health endpoint. Runs every registered HealthIndicator and answers 200 when
 * all pass or 503 when any fails, so a load balancer or uptime monitor can act on it.
 */
export function createHealthRouter({ version, indicators }: HealthDeps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const entries = await Promise.all(
      indicators.map(async (indicator) => [indicator.name, await runSafely(indicator)] as const),
    );
    const healthy = entries.every(([, result]) => result.status === 'ok');

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(entries),
    });
  });

  return router;
}

/** An indicator that throws must not take the endpoint down with it. */
async function runSafely(indicator: HealthIndicator): Promise<HealthCheckResult> {
  try {
    return await indicator.check();
  } catch (error) {
    return {
      status: 'error',
      latencyMs: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
