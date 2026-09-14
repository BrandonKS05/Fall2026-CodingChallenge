import { defineConfig } from 'vitest/config';

/**
 * Database-backed tests (`*.db.test.ts`), run with `pnpm test:db` against the
 * Docker Postgres. Files run one at a time because they share and truncate
 * the same database.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    fileParallelism: false,
    env: { RUN_DB_TESTS: '1' },
  },
});
