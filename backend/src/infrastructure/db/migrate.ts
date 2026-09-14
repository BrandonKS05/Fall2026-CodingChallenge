/**
 * Applies pending SQL migrations from backend/drizzle. Run with `pnpm db:migrate`.
 * Needs only DATABASE_URL, so it works before the rest of .env is filled in.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadDatabaseEnv, loadDotEnvFile, loadEnvOrExit } from '../../config/env.js';
import { createDatabase } from './client.js';

loadDotEnvFile();
const env = loadEnvOrExit(loadDatabaseEnv);
const database = createDatabase(env);

try {
  await migrate(database.db, {
    migrationsFolder: path.resolve(import.meta.dirname, '..', '..', '..', 'drizzle'),
  });
  console.log('Migrations applied');
} finally {
  await database.close();
}
