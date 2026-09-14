import type { Repositories } from '../../../ports/repositories/index.js';
import type { Db } from '../client.js';
import { DrizzleCollectionRepository } from './DrizzleCollectionRepository.js';
import { DrizzleMembershipRepository } from './DrizzleMembershipRepository.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';

/** Factory for the Postgres-backed repository set. The container calls this once. */
export function createDrizzleRepositories(db: Db): Repositories {
  return {
    users: new DrizzleUserRepository(db),
    collections: new DrizzleCollectionRepository(db),
    memberships: new DrizzleMembershipRepository(db),
  };
}
