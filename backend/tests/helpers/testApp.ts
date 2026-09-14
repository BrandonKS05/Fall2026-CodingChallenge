/** Builds the app with an explicit test environment so tests never depend on .env or a database. */
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createContainer, type ContainerOverrides } from '../../src/container.js';
import type { HealthIndicator } from '../../src/ports/HealthIndicator.js';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://trove:trove@localhost:5434/trove_test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  PIXABAY_API_KEY: 'test-key',
};

export const passingIndicator: HealthIndicator = {
  name: 'fake',
  check: async () => ({ status: 'ok', latencyMs: 0 }),
};

export function buildTestEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({ ...TEST_ENV, ...overrides });
}

export function buildTestApp(
  overrides: ContainerOverrides = {},
  env: Env = buildTestEnv(),
): Express {
  return createApp(createContainer(env, { healthIndicators: [passingIndicator], ...overrides }));
}
