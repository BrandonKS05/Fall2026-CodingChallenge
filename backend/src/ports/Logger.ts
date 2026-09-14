/**
 * Logging port. Services and controllers depend on this interface, never on
 * pino, so the logging library can change without touching business code.
 */
export interface LogFn {
  (message: string): void;
  (context: Record<string, unknown>, message?: string): void;
}

export interface Logger {
  fatal: LogFn;
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
  trace: LogFn;
  /** A logger that adds `bindings` to every line, e.g. { service: 'CollectionService' }. */
  child(bindings: Record<string, unknown>): Logger;
}
