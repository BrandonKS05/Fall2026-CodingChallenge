import type { RequestHandler } from 'express';
import { ApiError } from '../ApiError.js';

/** Mounted after every router: a request that reaches it matched no route. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
};
