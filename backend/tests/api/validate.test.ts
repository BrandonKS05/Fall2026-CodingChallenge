import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createErrorHandler } from '../../src/api/middleware/errorHandler.js';
import { getValidated, validate } from '../../src/api/middleware/validate.js';
import { asLogger, createPinoLogger } from '../../src/infrastructure/logging/pinoLogger.js';

const bodySchema = z.object({ title: z.string().min(1) });
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });
type Body = z.infer<typeof bodySchema>;
type Query = z.infer<typeof querySchema>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/things', validate({ body: bodySchema, query: querySchema }), (_req, res) => {
    res.json(getValidated<Body, Query>(res));
  });
  const logger = asLogger(createPinoLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
  app.use(createErrorHandler(logger, { exposeInternals: true }));
  return app;
}

describe('validate middleware', () => {
  it('normalizes and coerces input, dropping unknown keys', async () => {
    const res = await request(buildApp())
      .post('/things?page=3')
      .send({ title: 'ok', extra: 'dropped' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { title: 'ok' }, query: { page: 3 }, params: {} });
  });

  it('reports every issue with its request part in the path', async () => {
    const res = await request(buildApp()).post('/things?page=0').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['body.title', 'query.page']));
  });
});
