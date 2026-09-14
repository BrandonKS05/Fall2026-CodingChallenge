/**
 * Composition root.
 *
 * The only module that imports from infrastructure/. It builds each concrete
 * dependency once and exposes it through its port interface, so the rest of
 * the app depends on abstractions rather than implementations.
 */
import type { RequestHandler } from 'express';
import pkg from '../package.json' with { type: 'json' };
import type { Env } from './config/env.js';
import { createDatabase, type Database } from './infrastructure/db/client.js';
import { DatabaseHealthIndicator } from './infrastructure/db/DatabaseHealthIndicator.js';
import {
  asLogger,
  createPinoLogger,
  createRequestLogger,
} from './infrastructure/logging/pinoLogger.js';
import type { HealthIndicator } from './ports/HealthIndicator.js';
import type { Logger } from './ports/Logger.js';

export interface Container {
  env: Env;
  logger: Logger;
  /** HTTP access-log middleware. Built here because it needs the concrete pino instance. */
  requestLogger: RequestHandler;
  version: string;
  healthIndicators: HealthIndicator[];
  /** Releases pooled connections. Called once on shutdown. */
  dispose(): Promise<void>;
}

/** Test seams: replace infrastructure without touching the wiring. */
export interface ContainerOverrides {
  database?: Database;
  healthIndicators?: HealthIndicator[];
}

export function createContainer(env: Env, overrides: ContainerOverrides = {}): Container {
  const pinoLogger = createPinoLogger(env);
  const database = overrides.database ?? createDatabase(env);

  return {
    env,
    logger: asLogger(pinoLogger),
    requestLogger: createRequestLogger(pinoLogger),
    version: pkg.version,
    healthIndicators: overrides.healthIndicators ?? [new DatabaseHealthIndicator(database.db)],
    dispose: () => database.close(),
  };
}
