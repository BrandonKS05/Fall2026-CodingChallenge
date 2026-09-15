export type HealthCheckResult =
  { status: 'ok'; latencyMs: number } | { status: 'error'; latencyMs: number; message: string };

/**
 * Strategy: one implementation per dependency (database, storage, ...). The
 * health route runs all of them and aggregates the results. Implementations
 * must resolve rather than throw.
 */
export interface HealthIndicator {
  readonly name: string;
  check(): Promise<HealthCheckResult>;
}

/**
 * Runs one probe with a time limit and reports how long it took. Indicators
 * wrap their probe in this so a hung dependency degrades health instead of
 * stalling the endpoint.
 */
export async function timedCheck(
  probe: () => Promise<void>,
  timeoutMs: number,
): Promise<HealthCheckResult> {
  const started = performance.now();
  try {
    await withTimeout(probe(), timeoutMs);
    return { status: 'ok', latencyMs: elapsed(started) };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: elapsed(started),
      message: error instanceof Error ? error.message : 'Unknown error',
    };
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
