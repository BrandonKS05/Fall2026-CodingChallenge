import { defineConfig } from 'vitest/config';

/**
 * Unit and route tests live next to the code they cover as `*.test.ts`.
 * Database-backed tests use `*.db.test.ts` and run separately (pnpm test:db).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', '**/node_modules/**'],
    clearMocks: true,
  },
});
