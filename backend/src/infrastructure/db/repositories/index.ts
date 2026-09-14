import type { Repositories } from '../../../ports/repositories/index.js';
import type { Db } from '../client.js';
import { DrizzleCollectionRepository } from './DrizzleCollectionRepository.js';
import { DrizzleImageRepository } from './DrizzleImageRepository.js';
import { DrizzleItemRepository } from './DrizzleItemRepository.js';
import { DrizzleMembershipRepository } from './DrizzleMembershipRepository.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';

/** Factory for the Postgres-backed repository set. The container calls this once. */
export function createDrizzleRepositories(db: Db): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    collections: new DrizzleCollectionRepository(db),
    memberships: new DrizzleMembershipRepository(db),
    images: new DrizzleImageRepository(db),
    items: new DrizzleItemRepository(db),
    notifications: new DrizzleNotificationRepository(db),
  };
}
