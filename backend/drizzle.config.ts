import { defineConfig } from 'drizzle-kit';

// `generate` works offline; only `studio` and `push` need the database URL.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the process environment.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://wumboo:wumboo@localhost:5434/wumboo',
  },
  strict: true,
  verbose: true,
});
