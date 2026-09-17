/**
 * Postgres enums, defined from the domain constants so the database can never
 * drift from the domain. A test also checks them against the API contract.
 */
import { SEARCH_CATEGORIES } from '@wumboo/shared';
import { pgEnum } from 'drizzle-orm/pg-core';
import { COLLECTION_VISIBILITIES } from '../../../domain/entities/Collection.js';
import { CONVERSATION_MEMBER_STATES } from '../../../domain/entities/Conversation.js';
import { IMAGE_PROVIDERS } from '../../../domain/entities/Image.js';
import { INTERACTION_TYPES } from '../../../domain/entities/Interaction.js';
import { CENTROID_ORIGINS } from '../../../domain/entities/InterestCentroid.js';
import { COLLECTION_ROLES } from '../../../domain/entities/Membership.js';
import { NOTIFICATION_TYPES } from '../../../domain/entities/Notification.js';
import { VERIFICATION_CHANNELS } from '../../../domain/entities/Verification.js';

export const collectionVisibility = pgEnum('collection_visibility', COLLECTION_VISIBILITIES);
export const collectionRole = pgEnum('collection_role', COLLECTION_ROLES);
export const imageProvider = pgEnum('image_provider', IMAGE_PROVIDERS);
export const notificationType = pgEnum('notification_type', NOTIFICATION_TYPES);
export const verificationChannel = pgEnum('verification_channel', VERIFICATION_CHANNELS);
export const conversationMemberState = pgEnum(
  'conversation_member_state',
  CONVERSATION_MEMBER_STATES,
);

export const interactionType = pgEnum('interaction_type', INTERACTION_TYPES);
export const centroidOrigin = pgEnum('centroid_origin', CENTROID_ORIGINS);
/** The fixed list people pick from at sign-up, and the one seeded embedding each. */
export const searchCategory = pgEnum('search_category', SEARCH_CATEGORIES);
