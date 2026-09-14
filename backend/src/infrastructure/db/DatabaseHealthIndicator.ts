import { sql } from 'drizzle-orm';
import type { HealthCheckResult, HealthIndicator } from '../../ports/HealthIndicator.js';
import type { Db } from './client.js';

/** Round-trips a trivial query, bounded by a timeout so a hung pool cannot stall health. */
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(
    private readonly db: Db,
    private readonly timeoutMs = 2_000,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const started = performance.now();
    try {
      await withTimeout(this.db.execute(sql`select 1`), this.timeoutMs);
      return { status: 'ok', latencyMs: elapsed(started) };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: elapsed(started),
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
