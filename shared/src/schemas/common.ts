/**
 * Building blocks reused by every other schema: ids, timestamps, pagination,
 * and the single error envelope that every failed response uses.
 */
import { z } from 'zod';

/** Every entity is keyed by a UUID generated in the database. */
export const idSchema = z.uuid();

/** Timestamps cross the wire as ISO-8601 strings. */
export const timestampSchema = z.iso.datetime();

/** A user reference embedded in other resources (owner, actor, addedBy). */
export const userSummarySchema = z.object({
  id: idSchema,
  displayName: z.string(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

/** Query-string pagination. Values arrive as strings, so they are coerced. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(30),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Machine-readable error codes. The frontend switches on these, never on messages. */
export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Envelope for every non-2xx response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Extra context, e.g. field-level issues for VALIDATION_ERROR. */
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Rejects a PATCH body where every field is undefined. */
export const atLeastOneField = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((field) => field !== undefined);
