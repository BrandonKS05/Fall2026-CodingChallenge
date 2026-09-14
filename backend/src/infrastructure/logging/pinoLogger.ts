/**
 * pino implementation of the Logger port, plus the HTTP access logger, which
 * needs the concrete pino instance. Pretty output in development, JSON
 * elsewhere, silent in tests.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pino, type Logger as PinoLogger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Env } from '../../config/env.js';
import type { Logger } from '../../ports/Logger.js';

export function createPinoLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): PinoLogger {
  return pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}

/** Adapter: pino's logger satisfies the Logger port structurally. This makes the boundary explicit. */
export function asLogger(logger: PinoLogger): Logger {
  return logger;
}

/**
 * Access-log middleware. Assigns a request id, or propagates a caller-supplied
 * x-request-id, and echoes it in the response so log lines can be correlated.
 */
export function createRequestLogger(logger: PinoLogger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    serializers: {
      req: (req: { method?: string; url?: string }) => ({ method: req.method, url: req.url }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
