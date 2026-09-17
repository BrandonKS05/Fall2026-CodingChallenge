/** owner manages everything; editor changes items; viewer reads. */
export const COLLECTION_ROLES = ['owner', 'editor', 'viewer'] as const;
export type CollectionRole = (typeof COLLECTION_ROLES)[number];

export interface Membership {
  collectionId: string;
  userId: string;
  role: CollectionRole;
  createdAt: Date;
}

/** Read model for the members panel. */
export interface MemberDetail extends Membership {
  email: string;
  handle: string;
  displayName: string;
}
