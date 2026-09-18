/**
 * Process entry point: load .env, validate configuration, build the app,
 * listen, and shut down cleanly on SIGINT/SIGTERM.
 */
import { createApp } from './app.js';
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from './config/env.js';
import { createContainer } from './container.js';
import { seedDemo } from './infrastructure/db/seedDemo.js';

loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);
const container = createContainer(env);
const app = createApp(container);

const server = app.listen(env.PORT, () => {
  container.logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  // After listen, like the seed: the queue is durable, so catching up on
  // whatever is unembedded is never a reason to fail a health check.
  if (container.services.embeddings) {
    void container.services.embeddings.run().catch((error: unknown) => {
      container.logger.error({ err: error }, 'The embedding worker stopped');
    });
  } else {
    container.logger.warn('No OPENAI_API_KEY: pictures will not be embedded');
  }
  // What the feed has shown people is bounded by a retention window rather
  // than by use, so something has to do the forgetting. Daily, unref'd, so it
  // never holds the process open.
  const sweep = setInterval(
    () => {
      void container.services.recommendations.forgetOld().catch((error: unknown) => {
        container.logger.warn({ err: error }, 'Could not sweep old impressions');
      });
    },
    24 * 60 * 60 * 1000,
  );
  sweep.unref();
  void container.services.recommendations.forgetOld().catch(() => undefined);

  if (env.SEED_DEMO) {
    // After listen, so the host's health check passes while the seed downloads
    // images. The seed is idempotent and resumable, so the flag can stay on and
    // a boot that is cut short mid-seed simply finishes on the next one.
    void seedDemo(container).catch((error: unknown) => {
      container.logger.error({ err: error }, 'Demo seed failed');
    });
  }
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
