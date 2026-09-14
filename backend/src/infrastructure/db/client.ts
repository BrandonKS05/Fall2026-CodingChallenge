/**
 * Database connection. One pool per process, wrapped by Drizzle. Repositories
 * receive the `Db` handle; nothing outside infrastructure/ imports this file
 * except the composition root.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DatabaseEnv } from '../../config/env.js';
import * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  db: Db;
  /** Drains the pool. Call once on shutdown. */
  close(): Promise<void>;
}

export function createDatabase(env: DatabaseEnv): Database {
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, close: () => pool.end() };
}
