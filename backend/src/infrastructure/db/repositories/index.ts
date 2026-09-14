import type { Repositories } from '../../../ports/repositories/index.js';
import type { Db } from '../client.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';

/** Factory for the Postgres-backed repository set. The container calls this once. */
export function createDrizzleRepositories(db: Db): Repositories {
  return {
    users: new DrizzleUserRepository(db),
  };
}
