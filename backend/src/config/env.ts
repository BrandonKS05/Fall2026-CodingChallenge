/**
 * Environment configuration, validated once at startup with zod.
 *
 * Nothing else in the codebase reads process.env. Every module receives the
 * parsed `Env` through the container, which keeps configuration explicit,
 * typed, and easy to override in tests.
 */
import path from 'node:path';
import { z } from 'zod';

const databaseUrlSchema = z.url({
  protocol: /^postgres(ql)?$/,
  error: 'DATABASE_URL must be a postgres:// connection URL',
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: databaseUrlSchema,

    /** Signs session tokens. Rotating it signs every user out. */
    JWT_SECRET: z
      .string({ error: 'JWT_SECRET is required' })
      .min(32, 'JWT_SECRET must be at least 32 characters'),

    PIXABAY_API_KEY: z.string({ error: 'PIXABAY_API_KEY is required' }).min(1),

    /** Browser origin allowed to call the API with credentials. */
    CORS_ORIGIN: z.url().default('http://localhost:5173'),

    /** Selects the StorageBackend strategy. See infrastructure/storage. */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== 's3') return;
    const required = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** The subset database tooling needs, so `pnpm db:migrate` works before the Pixabay key exists. */
const databaseEnvSchema = z.object({ DATABASE_URL: databaseUrlSchema });
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

/** Thrown when the environment is invalid. Entry points print it and exit. */
export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    );
    this.name = 'EnvError';
  }
}

type EnvSource = Record<string, string | undefined>;

/** Empty strings count as unset, so a blank line in .env behaves like a missing one. */
function parseEnv<T>(schema: z.ZodType<T>, source: EnvSource): T {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = schema.safeParse(present);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map(
        (issue) => `${issue.path.map(String).join('.') || 'env'}: ${issue.message}`,
      ),
    );
  }
  return result.data;
}

export function loadEnv(source: EnvSource = process.env): Env {
  return parseEnv(envSchema, source);
}

export function loadDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
  return parseEnv(databaseEnvSchema, source);
}

/**
 * Loads backend/.env into process.env if it exists. A convenience for local
 * development; deployed environments set variables directly. Existing
 * variables win over the file.
 */
export function loadDotEnvFile(): void {
  try {
    process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '.env'));
  } catch {
    // No .env file: rely on the process environment.
  }
}

/** For entry points: run a loader, and exit with a readable message if the environment is invalid. */
export function loadEnvOrExit<T>(loader: () => T): T {
  try {
    return loader();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
