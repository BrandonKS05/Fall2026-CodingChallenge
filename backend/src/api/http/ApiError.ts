/**
 * The one error type the HTTP layer knows how to serialize.
 *
 * Services throw domain errors; the error handler maps those to ApiError.
 * Controllers and middleware throw ApiError directly for HTTP-specific
 * failures such as validation or authentication.
 */
import type { ApiErrorCode, ApiErrorResponse } from '@trove/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(details: unknown, message = 'Request validation failed'): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  static rateLimited(message = 'Too many requests, please slow down'): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message);
  }

  static upstream(message = 'An upstream service failed'): ApiError {
    return new ApiError(502, 'UPSTREAM_ERROR', message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }

  /** Serializes to the envelope defined in @trove/shared. */
  toBody(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }
}
