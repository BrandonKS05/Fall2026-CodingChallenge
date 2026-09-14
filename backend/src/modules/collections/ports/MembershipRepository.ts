import type {
  CollectionRole,
  MemberDetail,
  Membership,
} from '../../../domain/entities/Membership.js';

export interface NewMembership {
  collectionId: string;
  userId: string;
  role: CollectionRole;
}

export interface MembershipRepository {
  find(collectionId: string, userId: string): Promise<Membership | null>;
  /** Members with user details, owner first. */
  listByCollection(collectionId: string): Promise<MemberDetail[]>;
  /** Every member's user id, used to fan out notifications. */
  listMemberIds(collectionId: string): Promise<string[]>;
  /** Throws ConflictError when the user is already a member. */
  add(input: NewMembership): Promise<Membership>;
  /** Throws NotFoundError when the membership does not exist. */
  updateRole(collectionId: string, userId: string, role: CollectionRole): Promise<Membership>;
  remove(collectionId: string, userId: string): Promise<void>;
}
