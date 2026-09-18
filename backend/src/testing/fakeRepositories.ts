/** One call builds a consistent set of in-memory repositories that share the same users and images. */
import { InMemoryCategoryEmbeddingRepository } from './fakes/InMemoryCategoryEmbeddingRepository.js';
import { InMemoryCollectionRepository } from './fakes/InMemoryCollectionRepository.js';
import { InMemoryConversationRepository } from './fakes/InMemoryConversationRepository.js';
import { InMemoryImageRepository } from './fakes/InMemoryImageRepository.js';
import { InMemoryItemRepository } from './fakes/InMemoryItemRepository.js';
import { InMemoryLikeRepository } from './fakes/InMemoryLikeRepository.js';
import { InMemoryMembershipRepository } from './fakes/InMemoryMembershipRepository.js';
import { InMemoryMessageRepository } from './fakes/InMemoryMessageRepository.js';
import { InMemoryEmbeddingRepository } from './fakes/InMemoryEmbeddingRepository.js';
import { InMemoryFeedRepository } from './fakes/InMemoryFeedRepository.js';
import { InMemoryFollowRepository } from './fakes/InMemoryFollowRepository.js';
import { InMemoryInterestProfileRepository } from './fakes/InMemoryInterestProfileRepository.js';
import { InMemoryNotificationRepository } from './fakes/InMemoryNotificationRepository.js';
import { InMemoryUserRepository } from './fakes/InMemoryUserRepository.js';
import { InMemoryVerificationCodeRepository } from './fakes/InMemoryVerificationCodeRepository.js';

export function createFakeRepositories() {
  const users = new InMemoryUserRepository();
  const verificationCodes = new InMemoryVerificationCodeRepository();
  const memberships = new InMemoryMembershipRepository(users);
  const images = new InMemoryImageRepository();
  const items = new InMemoryItemRepository(images, users, memberships);
  const likes = new InMemoryLikeRepository();
  const collections = new InMemoryCollectionRepository(users, memberships, items, likes);
  const notifications = new InMemoryNotificationRepository(users, collections);
  const follows = new InMemoryFollowRepository(users);
  const messages = new InMemoryMessageRepository(users);
  const conversations = new InMemoryConversationRepository(users, messages);
  return {
    embeddings: new InMemoryEmbeddingRepository(),
    categoryEmbeddings: new InMemoryCategoryEmbeddingRepository(),
    interestProfiles: new InMemoryInterestProfileRepository(),
    feed: new InMemoryFeedRepository(),
    users,
    verificationCodes,
    memberships,
    likes,
    images,
    items,
    collections,
    notifications,
    follows,
    conversations,
    messages,
  };
}
