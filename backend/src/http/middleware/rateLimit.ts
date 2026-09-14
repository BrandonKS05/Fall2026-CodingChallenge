import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ApiError } from '../ApiError.js';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
}

/** Per-client fixed-window limiter. Exceeding it yields the standard RATE_LIMITED envelope. */
export function createRateLimiter({ windowMs, limit }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.rateLimited()),
  });
}
