import { apiErrorResponseSchema, type ApiErrorCode } from '@trove/shared';

/** A non-2xx response, carrying the machine-readable code from the shared error envelope. */
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

  static fromResponse(status: number, body: unknown): ApiError {
    const parsed = apiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiError(status, code, message, details);
    }
    return new ApiError(
      status,
      status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      `Request failed (${status})`,
    );
  }

  static is(error: unknown, code?: ApiErrorCode): error is ApiError {
    return error instanceof ApiError && (code === undefined || error.code === code);
  }
}
