/**
 * The domain constants, the Postgres enums, and the API contract must agree.
 * This guards against adding a value in one place and forgetting the others.
 */
import {
  collectionRoleSchema,
  collectionVisibilitySchema,
  imageProviderSchema,
  notificationTypeSchema,
} from '@trove/shared';
import { describe, expect, it } from 'vitest';
import { COLLECTION_VISIBILITIES } from '../../../domain/entities/Collection.js';
import { IMAGE_PROVIDERS } from '../../../domain/entities/Image.js';
import { COLLECTION_ROLES } from '../../../domain/entities/Membership.js';
import { NOTIFICATION_TYPES } from '../../../domain/entities/Notification.js';
import { collectionRole, collectionVisibility, imageProvider, notificationType } from './index.js';

describe('enum consistency across domain, database, and contract', () => {
  it.each([
    [
      'collection visibility',
      COLLECTION_VISIBILITIES,
      collectionVisibility,
      collectionVisibilitySchema,
    ],
    ['collection role', COLLECTION_ROLES, collectionRole, collectionRoleSchema],
    ['image provider', IMAGE_PROVIDERS, imageProvider, imageProviderSchema],
    ['notification type', NOTIFICATION_TYPES, notificationType, notificationTypeSchema],
  ])('%s', (_name, domainValues, pgEnum, contractSchema) => {
    expect([...pgEnum.enumValues]).toEqual([...domainValues]);
    expect([...contractSchema.options]).toEqual([...domainValues]);
  });
});
