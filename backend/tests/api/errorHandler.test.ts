import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../src/api/middleware/errorHandler.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidOperationError,
  NotFoundError,
} from '../../src/domain/errors/index.js';
import { asLogger, createPinoLogger } from '../../src/infrastructure/logging/pinoLogger.js';

function buildApp(exposeInternals: boolean) {
  const app = express();
  app.get('/not-found', () => {
    throw new NotFoundError('Collection', 'abc');
  });
  app.get('/forbidden', () => {
    throw new ForbiddenError();
  });
  app.get('/conflict', () => {
    throw new ConflictError('Email already registered');
  });
  app.get('/invalid', () => {
    throw new InvalidOperationError('Owners cannot leave their own board');
  });
  app.get('/boom', () => {
    throw new Error('database exploded');
  });
  const logger = asLogger(createPinoLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }));
  app.use(createErrorHandler(logger, { exposeInternals }));
  return app;
}

describe('error handler domain mapping', () => {
  it.each([
    ['/not-found', 404, 'NOT_FOUND', 'Collection abc not found'],
    ['/forbidden', 403, 'FORBIDDEN', 'You do not have permission to do this'],
    ['/conflict', 409, 'CONFLICT', 'Email already registered'],
    ['/invalid', 400, 'VALIDATION_ERROR', 'Owners cannot leave their own board'],
  ])('%s -> %i %s', async (path, status, code, message) => {
    const res = await request(buildApp(true)).get(path);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: { code, message } });
  });

  it('exposes unexpected error messages only when asked to', async () => {
    const dev = await request(buildApp(true)).get('/boom');
    expect(dev.status).toBe(500);
    expect(dev.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'database exploded' });

    const prod = await request(buildApp(false)).get('/boom');
    expect(prod.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
