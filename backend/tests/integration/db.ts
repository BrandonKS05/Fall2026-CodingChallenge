/**
 * Harness for tests that need a real Postgres. Creates the test database on
 * first use, applies migrations, and truncates between tests. Enabled only by
 * vitest.integration.config.ts (pnpm test:db); the default suite skips these.
 */
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createDatabase, type Database, type Db } from '../../src/infrastructure/db/client.js';

export const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://trove:trove@localhost:5434/trove_test';

export async function connectTestDatabase(): Promise<Database> {
  await ensureDatabaseExists(TEST_DATABASE_URL);
  const database = createDatabase({ DATABASE_URL: TEST_DATABASE_URL });
  await migrate(database.db, {
    migrationsFolder: path.resolve(import.meta.dirname, '..', '..', 'drizzle'),
  });
  return database;
}

/** Empties every table. CASCADE means the order does not matter. */
export async function truncateAll(db: Db): Promise<void> {
  await db.execute(
    sql`truncate table notifications, collection_members, collection_items, images, collections, users cascade`,
  );
}

async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const databaseName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const pool = new Pool({ connectionString: admin.toString() });
  try {
    const existing = await pool.query('select 1 from pg_database where datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await pool.query(`create database "${databaseName}"`);
    }
  } catch (error) {
    // 42P04 = duplicate_database: another worker created it first.
    if (!(error instanceof Error && 'code' in error && error.code === '42P04')) throw error;
  } finally {
    await pool.end();
  }
}
