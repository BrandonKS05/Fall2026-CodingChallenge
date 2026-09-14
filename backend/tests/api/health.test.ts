import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { HealthIndicator } from '../../src/ports/HealthIndicator.js';
import { buildTestApp, passingIndicator } from '../helpers/testApp.js';

const failingIndicator: HealthIndicator = {
  name: 'broken',
  check: async () => ({ status: 'error', latencyMs: 12, message: 'connection refused' }),
};

const throwingIndicator: HealthIndicator = {
  name: 'explosive',
  check: async () => {
    throw new Error('kaboom');
  },
};

describe('GET /api/health with indicators', () => {
  it('is ok with per-check results when every indicator passes', async () => {
    const res = await request(buildTestApp({ healthIndicators: [passingIndicator] })).get(
      '/api/health',
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toEqual({ fake: { status: 'ok', latencyMs: 0 } });
  });

  it('is degraded with 503 when any indicator fails', async () => {
    const app = buildTestApp({ healthIndicators: [passingIndicator, failingIndicator] });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.broken).toEqual({
      status: 'error',
      latencyMs: 12,
      message: 'connection refused',
    });
  });

  it('contains a throwing indicator instead of crashing', async () => {
    const res = await request(buildTestApp({ healthIndicators: [throwingIndicator] })).get(
      '/api/health',
    );
    expect(res.status).toBe(503);
    expect(res.body.checks.explosive).toMatchObject({ status: 'error', message: 'kaboom' });
  });
});
