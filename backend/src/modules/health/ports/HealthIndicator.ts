export type HealthCheckResult =
  { status: 'ok'; latencyMs: number } | { status: 'error'; latencyMs: number; message: string };

/**
 * Strategy: one implementation per dependency (database, image provider,
 * storage). The health route runs all of them and aggregates the results.
 * Implementations must resolve rather than throw.
 */
export interface HealthIndicator {
  readonly name: string;
  check(): Promise<HealthCheckResult>;
}
