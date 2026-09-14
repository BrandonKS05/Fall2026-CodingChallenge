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
import { SESSION_TTL_SECONDS } from './config/session.js';
import { Argon2PasswordHasher } from './infrastructure/auth/Argon2PasswordHasher.js';
import { JoseTokenService } from './infrastructure/auth/JoseTokenService.js';
import { createDatabase, type Database } from './infrastructure/db/client.js';
import { DatabaseHealthIndicator } from './infrastructure/db/DatabaseHealthIndicator.js';
import { createDrizzleRepositories } from './infrastructure/db/repositories/index.js';
import {
  asLogger,
  createPinoLogger,
  createRequestLogger,
} from './infrastructure/logging/pinoLogger.js';
import type { HealthIndicator } from './ports/HealthIndicator.js';
import type { Logger } from './ports/Logger.js';
import type { PasswordHasher } from './ports/PasswordHasher.js';
import type { Repositories } from './ports/repositories/index.js';
import type { TokenService } from './ports/TokenService.js';
import { AuthService } from './services/AuthService.js';

export interface Services {
  auth: AuthService;
}

export interface Container {
  env: Env;
  logger: Logger;
  /** HTTP access-log middleware. Built here because it needs the concrete pino instance. */
  requestLogger: RequestHandler;
  version: string;
  healthIndicators: HealthIndicator[];
  repositories: Repositories;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  services: Services;
  /** Releases pooled connections. Called once on shutdown. */
  dispose(): Promise<void>;
}

/** Test seams: replace any piece of infrastructure without touching the wiring. */
export interface ContainerOverrides {
  database?: Database;
  healthIndicators?: HealthIndicator[];
  repositories?: Partial<Repositories>;
  passwordHasher?: PasswordHasher;
  tokens?: TokenService;
}

export function createContainer(env: Env, overrides: ContainerOverrides = {}): Container {
  const pinoLogger = createPinoLogger(env);
  const logger = asLogger(pinoLogger);
  const database = overrides.database ?? createDatabase(env);

  const repositories: Repositories = {
    ...createDrizzleRepositories(database.db),
    ...overrides.repositories,
  };
  const passwordHasher = overrides.passwordHasher ?? new Argon2PasswordHasher();
  const tokens = overrides.tokens ?? new JoseTokenService(env.JWT_SECRET, SESSION_TTL_SECONDS);

  const services: Services = {
    auth: new AuthService({ users: repositories.users, passwordHasher, tokens, logger }),
  };

  return {
    env,
    logger,
    requestLogger: createRequestLogger(pinoLogger),
    version: pkg.version,
    healthIndicators: overrides.healthIndicators ?? [new DatabaseHealthIndicator(database.db)],
    repositories,
    passwordHasher,
    tokens,
    services,
    dispose: () => database.close(),
  };
}
