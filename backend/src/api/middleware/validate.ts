/**
 * Request validation middleware. Parses body, query, and params with zod
 * schemas from @trove/shared so controllers only ever see typed, normalized
 * input. Failures short-circuit to the error handler as VALIDATION_ERROR,
 * with every issue's path prefixed by the request part it belongs to.
 *
 * Parsed values live on res.locals.validated rather than being written back
 * to the request, because Express 5 exposes req.query as a read-only getter.
 */
import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../http/ApiError.js';
import { toValidationDetails, type ValidationDetail } from '../http/validationDetails.js';

export interface Validated<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

const PARTS = ['body', 'query', 'params'] as const;

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    const validated: Validated = { body: req.body, query: req.query, params: req.params };
    const issues: ValidationDetail[] = [];

    for (const part of PARTS) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        validated[part] = result.data;
      } else {
        issues.push(...toValidationDetails(result.error.issues, part));
      }
    }

    if (issues.length > 0) {
      next(ApiError.validation(issues));
      return;
    }
    res.locals.validated = validated;
    next();
  };
}

/** Typed accessor for controllers. Pass the schemas' inferred types as generics. */
export function getValidated<TBody = unknown, TQuery = unknown, TParams = unknown>(
  res: Response,
): Validated<TBody, TQuery, TParams> {
  return res.locals.validated as Validated<TBody, TQuery, TParams>;
}
