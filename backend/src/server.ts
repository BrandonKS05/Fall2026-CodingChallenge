/**
 * Process entry point: load .env, validate configuration, build the app,
 * listen, and shut down cleanly on SIGINT/SIGTERM.
 */
import path from 'node:path';
import { createApp } from './app.js';
import { EnvError, loadEnv, type Env } from './config/env.js';
import { createContainer } from './container.js';

// backend/.env is a convenience for local development. Deployed environments set variables directly.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '.env'));
} catch {
  // No .env file: rely on the process environment.
}

function readEnv(): Env {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const env = readEnv();
const container = createContainer(env);
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  container.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
});

function shutdown(signal: NodeJS.Signals): void {
  container.logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  // Force exit if open connections do not drain in time.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
