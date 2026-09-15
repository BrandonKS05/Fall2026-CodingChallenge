/**
 * @wumboo/shared - the API contract.
 *
 * Both the frontend and the backend import from here and nowhere else in this
 * package. The backend validates requests against these schemas; the frontend
 * uses the inferred types. Neither side depends on the other.
 */
export * from './schemas/common.js';
export * from './schemas/auth.js';
export * from './schemas/search.js';
export * from './schemas/collection.js';
export * from './schemas/preferences.js';
export * from './schemas/explore.js';
export * from './schemas/item.js';
export * from './schemas/share.js';
export * from './schemas/notification.js';
