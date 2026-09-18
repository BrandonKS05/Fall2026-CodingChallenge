/**
 * Every repository port the application uses, and the Postgres-backed set
 * that satisfies them. Each module owns its port and its Drizzle adapter;
 * this file only groups them so the composition root wires them in one go.
 */
import type { UserRepository } from '../../modules/auth/ports/UserRepository.js';
import type { VerificationCodeRepository } from '../../modules/auth/ports/VerificationCodeRepository.js';
import { DrizzleVerificationCodeRepository } from '../../modules/auth/adapters/DrizzleVerificationCodeRepository.js';
import { DrizzleUserRepository } from '../../modules/auth/adapters/DrizzleUserRepository.js';
import type { CollectionRepository } from '../../modules/collections/ports/CollectionRepository.js';
import type { LikeRepository } from '../../modules/collections/ports/LikeRepository.js';
import type { MembershipRepository } from '../../modules/collections/ports/MembershipRepository.js';
import { DrizzleCollectionRepository } from '../../modules/collections/adapters/DrizzleCollectionRepository.js';
import { DrizzleLikeRepository } from '../../modules/collections/adapters/DrizzleLikeRepository.js';
import { DrizzleMembershipRepository } from '../../modules/collections/adapters/DrizzleMembershipRepository.js';
import type { ImageRepository } from '../../modules/images/ports/ImageRepository.js';
import { DrizzleImageRepository } from '../../modules/images/adapters/DrizzleImageRepository.js';
import type { ItemRepository } from '../../modules/items/ports/ItemRepository.js';
import { DrizzleItemRepository } from '../../modules/items/adapters/DrizzleItemRepository.js';
import type { ConversationRepository } from '../../modules/messaging/ports/ConversationRepository.js';
import type { MessageRepository } from '../../modules/messaging/ports/MessageRepository.js';
import { DrizzleConversationRepository } from '../../modules/messaging/adapters/DrizzleConversationRepository.js';
import { DrizzleMessageRepository } from '../../modules/messaging/adapters/DrizzleMessageRepository.js';
import type { FollowRepository } from '../../modules/social/ports/FollowRepository.js';
import { DrizzleFollowRepository } from '../../modules/social/adapters/DrizzleFollowRepository.js';
import type { NotificationRepository } from '../../modules/notifications/ports/NotificationRepository.js';
import { DrizzleNotificationRepository } from '../../modules/notifications/adapters/DrizzleNotificationRepository.js';
import type { EmbeddingRepository } from '../../modules/recommendations/ports/EmbeddingRepository.js';
import { DrizzleEmbeddingRepository } from '../../modules/recommendations/adapters/DrizzleEmbeddingRepository.js';
import type { CategoryEmbeddingRepository } from '../../modules/recommendations/ports/CategoryEmbeddingRepository.js';
import { DrizzleCategoryEmbeddingRepository } from '../../modules/recommendations/adapters/DrizzleCategoryEmbeddingRepository.js';
import type { InterestProfileRepository } from '../../modules/recommendations/ports/InterestProfileRepository.js';
import { DrizzleInterestProfileRepository } from '../../modules/recommendations/adapters/DrizzleInterestProfileRepository.js';
import type { Db } from './client.js';

export interface Repositories {
  users: UserRepository;
  verificationCodes: VerificationCodeRepository;
  collections: CollectionRepository;
  memberships: MembershipRepository;
  likes: LikeRepository;
  images: ImageRepository;
  items: ItemRepository;
  notifications: NotificationRepository;
  follows: FollowRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  embeddings: EmbeddingRepository;
  categoryEmbeddings: CategoryEmbeddingRepository;
  interestProfiles: InterestProfileRepository;
}

export function createDrizzleRepositories(db: Db): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    verificationCodes: new DrizzleVerificationCodeRepository(db),
    collections: new DrizzleCollectionRepository(db),
    memberships: new DrizzleMembershipRepository(db),
    likes: new DrizzleLikeRepository(db),
    images: new DrizzleImageRepository(db),
    items: new DrizzleItemRepository(db),
    notifications: new DrizzleNotificationRepository(db),
    follows: new DrizzleFollowRepository(db),
    conversations: new DrizzleConversationRepository(db),
    messages: new DrizzleMessageRepository(db),
    embeddings: new DrizzleEmbeddingRepository(db),
    categoryEmbeddings: new DrizzleCategoryEmbeddingRepository(db),
    interestProfiles: new DrizzleInterestProfileRepository(db),
  };
}
