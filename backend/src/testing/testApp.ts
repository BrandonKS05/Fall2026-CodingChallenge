/** Builds the app with an explicit test environment so tests never depend on .env, a database, disk, or the network. */
import type { Express } from 'express';
import { createApp } from '../app.js';
import { loadEnv, type Env } from '../config/env.js';
import { createContainer, type ContainerOverrides } from '../container.js';
import type { HealthIndicator } from '../modules/health/HealthIndicator.js';
import { createFakeFetch } from './fakes/fakeFetch.js';
import { FakeImageProvider } from './fakes/FakeImageProvider.js';
import { InMemoryStorage } from './fakes/InMemoryStorage.js';

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
  return createApp(
    createContainer(env, {
      healthIndicators: [passingIndicator],
      storage: new InMemoryStorage(),
      imageProvider: new FakeImageProvider([]),
      fetchFn: createFakeFetch({}),
      ...overrides,
    }),
  );
}
