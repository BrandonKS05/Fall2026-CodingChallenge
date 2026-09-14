/** Builds the app with an explicit test environment so tests never depend on .env. */
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { createContainer } from '../../src/container.js';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://trove:trove@localhost:5433/trove_test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  PIXABAY_API_KEY: 'test-key',
};

export function buildTestEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({ ...TEST_ENV, ...overrides });
}

export function buildTestApp(env: Env = buildTestEnv()): Express {
  return createApp(createContainer(env));
}
