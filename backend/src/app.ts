/**
 * Builds the Express application from a container. Pure assembly: the
 * middleware order (a Chain of Responsibility) is defined here and nowhere
 * else. Separate from server.ts so tests can build the app without listening.
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { createErrorHandler } from './http/middleware/errorHandler.js';
import { notFound } from './http/middleware/notFound.js';
import { createApiRouter } from './http/router.js';
import type { Container } from './container.js';

export function createApp(container: Container): Express {
  const { env, logger } = container;
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in production, so req.ip and secure cookies resolve correctly.
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  // 1. Security headers. Stored images are served from this API to the frontend origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // 2. CORS with credentials so the frontend can send the session cookie.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // 3. Body and cookie parsing.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  // 4. Access log with request ids.
  app.use(container.requestLogger);
  // 5. Routes.
  app.use('/api', createApiRouter(container));
  // 6. Fallthrough and error serialization.
  app.use(notFound);
  app.use(createErrorHandler(logger, { exposeInternals: env.NODE_ENV !== 'production' }));

  return app;
}
