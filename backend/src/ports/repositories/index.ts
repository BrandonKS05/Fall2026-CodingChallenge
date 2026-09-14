import type { CollectionRepository } from './CollectionRepository.js';
import type { MembershipRepository } from './MembershipRepository.js';
import type { UserRepository } from './UserRepository.js';

export type * from './UserRepository.js';
export type * from './CollectionRepository.js';
export type * from './ImageRepository.js';
export type * from './ItemRepository.js';
export type * from './MembershipRepository.js';
export type * from './NotificationRepository.js';

/** Every repository the application uses, grouped for the composition root. Grows with each feature slice. */
export interface Repositories {
  users: UserRepository;
  collections: CollectionRepository;
  memberships: MembershipRepository;
}
