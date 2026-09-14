/**
 * Process entry point: load .env, validate configuration, build the app,
 * listen, and shut down cleanly on SIGINT/SIGTERM.
 */
import { createApp } from './app.js';
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from './config/env.js';
import { createContainer } from './container.js';

loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);
const container = createContainer(env);
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  container.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
});

function shutdown(signal: NodeJS.Signals): void {
  container.logger.info({ signal }, 'Shutting down');
  server.close(() => {
    void container.dispose().finally(() => process.exit(0));
  });
  // Force exit if open connections do not drain in time.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
