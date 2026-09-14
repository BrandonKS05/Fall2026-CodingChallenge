import type { z } from 'zod';

/** The shape of each entry in a VALIDATION_ERROR's `details`. */
export interface ValidationDetail {
  /** Dotted location, prefixed with the request part, e.g. "body.email" or "params.id". */
  path: string;
  code: string;
  message: string;
}

/** Trims zod issues to what a client can act on, dropping internals like regex patterns. */
export function toValidationDetails(
  issues: readonly z.core.$ZodIssue[],
  prefix?: string,
): ValidationDetail[] {
  return issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    code: issue.code,
    message: issue.message,
  }));
}
