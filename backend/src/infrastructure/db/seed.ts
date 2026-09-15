/** CLI entry for the demo seed: `pnpm db:seed`. */
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from '../../config/env.js';
import { createContainer } from '../../container.js';
import { seedDemo } from './seedDemo.js';

// The summary lines are the output that matters; keep service logs to warnings and above.
process.env.LOG_LEVEL ??= 'warn';
loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);
const container = createContainer(env);
try {
  await seedDemo(container);
} finally {
  await container.dispose();
}
