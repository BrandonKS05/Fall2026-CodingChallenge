import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from './errorHandler.js';
import { createRateLimiter } from './rateLimit.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';

describe('rate limiter', () => {
  it('returns the RATE_LIMITED envelope once the window limit is exceeded', async () => {
    const app = express();
    app.get('/ping', createRateLimiter({ windowMs: 60_000, limit: 2 }), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(createErrorHandler(silentLogger, { exposeInternals: true }));

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    const limited = await request(app).get('/ping');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.headers['ratelimit-policy'] ?? limited.headers['ratelimit']).toBeDefined();
  });
});
