/**
 * Final link in the middleware chain. Every error, thrown or passed to
 * next(), ends here and is serialized into the shared error envelope.
 *
 * Mapping: ApiError as-is; domain errors by kind; zod errors and body-parser
 * client errors become VALIDATION_ERROR; anything else is a 500 whose message
 * is hidden in production.
 */
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/errors/index.js';
import type { Logger } from '../../ports/Logger.js';
import { ApiError } from '../http/ApiError.js';

interface ErrorHandlerOptions {
  /** Include real error messages in 500 responses. Never enable in production. */
  exposeInternals: boolean;
}

export function createErrorHandler(
  logger: Logger,
  options: ErrorHandlerOptions,
): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const apiError = toApiError(error);

    if (apiError.status >= 500) {
      logger.error(
        {
          err: error,
          requestId: res.getHeader('x-request-id'),
          method: req.method,
          url: req.originalUrl,
        },
        'Request failed',
      );
    }

    const body = apiError.toBody();
    if (apiError.status >= 500 && !options.exposeInternals) {
      body.error.message = 'Internal server error';
    }
    res.status(apiError.status).json(body);
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DomainError) return fromDomainError(error);
  if (error instanceof ZodError) return ApiError.validation(error.issues);
  if (isClientError(error)) return new ApiError(error.status, 'VALIDATION_ERROR', error.message);
  return ApiError.internal(error instanceof Error ? error.message : 'Unknown error');
}

/** The single place where domain error kinds meet HTTP status codes. */
function fromDomainError(error: DomainError): ApiError {
  switch (error.kind) {
    case 'not_found':
      return ApiError.notFound(error.message);
    case 'forbidden':
      return ApiError.forbidden(error.message);
    case 'conflict':
      return ApiError.conflict(error.message);
    case 'invalid':
      return ApiError.validation(undefined, error.message);
  }
}

/** Body-parser failures (malformed JSON, payload too large) arrive as errors with a 4xx status. */
function isClientError(error: unknown): error is Error & { status: number } {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  );
}
