/** Helpers for translating driver errors into domain errors inside repositories. */

const UNIQUE_VIOLATION = '23505';

interface DriverErrorShape {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

/**
 * True when `error`, or an error it wraps (Drizzle wraps driver errors as
 * `cause`), is a Postgres unique violation, optionally on one constraint.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && typeof current === 'object'; depth += 1) {
    const candidate = current as DriverErrorShape;
    if (candidate.code === UNIQUE_VIOLATION) {
      return constraint === undefined || candidate.constraint === constraint;
    }
    current = candidate.cause;
  }
  return false;
}
