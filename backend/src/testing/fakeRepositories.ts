/** One call builds a consistent set of in-memory repositories that share the same users and images. */
import { InMemoryCollectionRepository } from './fakes/InMemoryCollectionRepository.js';
import { InMemoryImageRepository } from './fakes/InMemoryImageRepository.js';
import { InMemoryItemRepository } from './fakes/InMemoryItemRepository.js';
import { InMemoryMembershipRepository } from './fakes/InMemoryMembershipRepository.js';
import { InMemoryNotificationRepository } from './fakes/InMemoryNotificationRepository.js';
import { InMemoryUserRepository } from './fakes/InMemoryUserRepository.js';

export function createFakeRepositories() {
  const users = new InMemoryUserRepository();
  const memberships = new InMemoryMembershipRepository(users);
  const images = new InMemoryImageRepository();
  const items = new InMemoryItemRepository(images, users);
  const collections = new InMemoryCollectionRepository(users, memberships, items);
  const notifications = new InMemoryNotificationRepository(users, collections);
  return { users, memberships, images, items, collections, notifications };
}
