/**
 * Builds the app with an explicit test environment so tests never depend on
 * .env, a database, disk, or the network. The database rule is enforced, not
 * assumed: the container gets a handle that throws on first use, so a test
 * that forgets to pass fake repositories fails on every machine instead of
 * passing wherever a migrated local database happens to exist.
 */
import type { Express } from 'express';
import { createApp } from '../app.js';
import { loadEnv, type Env } from '../config/env.js';
import { createContainer, type ContainerOverrides } from '../container.js';
import type { Database, Db } from '../infrastructure/db/client.js';
import type { HealthIndicator } from '../modules/health/ports/HealthIndicator.js';
import { createFakeRepositories } from './fakeRepositories.js';
import { createFakeFetch } from './fakes/fakeFetch.js';
import { FakeImageProvider } from './fakes/FakeImageProvider.js';
import { InMemoryStorage } from './fakes/InMemoryStorage.js';
import { RecordingCodeSender } from './fakes/RecordingCodeSender.js';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://wumboo:wumboo@localhost:5434/wumboo_test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  PIXABAY_API_KEY: 'test-key',
};

/** A database handle that fails loudly if anything reaches it. */
export const noDatabase: Database = {
  db: new Proxy({} as Db, {
    get(_target, property) {
      throw new Error(
        `Unit tests must not touch the database (accessed db.${String(property)}); pass fake repositories`,
      );
    },
  }),
  close: async () => undefined,
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
  // Repositories merge rather than replace: a test that wants to hold on to one
  // of them should not lose the rest to the database proxy.
  const { repositories, ...rest } = overrides;
  // Codes have to go somewhere a test can read them; the recorder is that
  // somewhere, and `codesOf` hands it back to whoever needs to type one in.
  const codes = new RecordingCodeSender();
  const app = createApp(
    createContainer(env, {
      database: noDatabase,
      healthIndicators: [passingIndicator],
      storage: new InMemoryStorage(),
      imageProvider: new FakeImageProvider([]),
      fetchFn: createFakeFetch({}),
      emailSender: codes,
      ...rest,
      repositories: { ...createFakeRepositories(), ...repositories },
    }),
  );
  app.locals.codes = overrides.emailSender ?? codes;
  return app;
}

/** The messages this app "sent", so a test can read a code back out of one. */
export function codesOf(app: Express): RecordingCodeSender {
  return app.locals.codes as RecordingCodeSender;
}
