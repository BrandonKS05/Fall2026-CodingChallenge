import { sql } from 'drizzle-orm';
import {
  timedCheck,
  type HealthCheckResult,
  type HealthIndicator,
} from '../../modules/health/ports/HealthIndicator.js';
import type { Db } from './client.js';

/** Round-trips a trivial query, bounded by a timeout so a hung pool cannot stall health. */
export class DatabaseHealthIndicator implements HealthIndicator {
  readonly name = 'database';

  constructor(
    private readonly db: Db,
    private readonly timeoutMs = 2_000,
  ) {}

  check(): Promise<HealthCheckResult> {
    return timedCheck(async () => {
      await this.db.execute(sql`select 1`);
    }, this.timeoutMs);
  }
}
