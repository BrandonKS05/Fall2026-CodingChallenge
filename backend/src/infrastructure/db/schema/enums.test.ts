/**
 * The domain constants, the Postgres enums, and the API contract must agree.
 * This guards against adding a value in one place and forgetting the others.
 */
import {
  SEARCH_CATEGORIES,
  collectionRoleSchema,
  collectionVisibilitySchema,
  imageProviderSchema,
  notificationTypeSchema,
  searchCategorySchema,
} from '@wumboo/shared';
import { describe, expect, it } from 'vitest';
import { COLLECTION_VISIBILITIES } from '../../../domain/entities/Collection.js';
import { IMAGE_PROVIDERS } from '../../../domain/entities/Image.js';
import { INTERACTION_TYPES } from '../../../domain/entities/Interaction.js';
import { CENTROID_ORIGINS } from '../../../domain/entities/InterestCentroid.js';
import { COLLECTION_ROLES } from '../../../domain/entities/Membership.js';
import { NOTIFICATION_TYPES } from '../../../domain/entities/Notification.js';
import {
  centroidOrigin,
  collectionRole,
  collectionVisibility,
  imageProvider,
  interactionType,
  notificationType,
  searchCategory,
} from './index.js';

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
    ['search category', SEARCH_CATEGORIES, searchCategory, searchCategorySchema],
  ])('%s', (_name, domainValues, pgEnum, contractSchema) => {
    expect([...pgEnum.enumValues]).toEqual([...domainValues]);
    expect([...contractSchema.options]).toEqual([...domainValues]);
  });
});

/** Not every enum reaches the API. These two are the database's business alone. */
describe('enum consistency between domain and database', () => {
  it.each([
    ['interaction type', INTERACTION_TYPES, interactionType],
    ['centroid origin', CENTROID_ORIGINS, centroidOrigin],
  ])('%s', (_name, domainValues, pgEnum) => {
    expect([...pgEnum.enumValues]).toEqual([...domainValues]);
  });
});
