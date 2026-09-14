/**
 * Postgres enums, defined from the domain constants so the database can never
 * drift from the domain. A test also checks them against the API contract.
 */
import { pgEnum } from 'drizzle-orm/pg-core';
import { COLLECTION_VISIBILITIES } from '../../../domain/entities/Collection.js';
import { IMAGE_PROVIDERS } from '../../../domain/entities/Image.js';
import { COLLECTION_ROLES } from '../../../domain/entities/Membership.js';
import { NOTIFICATION_TYPES } from '../../../domain/entities/Notification.js';

export const collectionVisibility = pgEnum('collection_visibility', COLLECTION_VISIBILITIES);
export const collectionRole = pgEnum('collection_role', COLLECTION_ROLES);
export const imageProvider = pgEnum('image_provider', IMAGE_PROVIDERS);
export const notificationType = pgEnum('notification_type', NOTIFICATION_TYPES);
