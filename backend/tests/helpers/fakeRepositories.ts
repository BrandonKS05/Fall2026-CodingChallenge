/** One call builds a consistent set of in-memory repositories that share the same users. */
import { InMemoryCollectionRepository } from '../fakes/InMemoryCollectionRepository.js';
import { InMemoryMembershipRepository } from '../fakes/InMemoryMembershipRepository.js';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository.js';

export function createFakeRepositories() {
  const users = new InMemoryUserRepository();
  const memberships = new InMemoryMembershipRepository(users);
  const collections = new InMemoryCollectionRepository(users, memberships);
  return { users, memberships, collections };
}
