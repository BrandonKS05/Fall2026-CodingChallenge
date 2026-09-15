/**
 * Authorization rules for collections, as pure functions. Services call these
 * before acting; nothing here knows about HTTP or the database.
 */
import type { Collection } from '../entities/Collection.js';
import type { CollectionRole } from '../entities/Membership.js';

const ROLE_RANK: Record<CollectionRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** True when `role` grants at least the permissions of `required`. */
export function roleAtLeast(role: CollectionRole, required: CollectionRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/**
 * Members can always view. For everyone else the visibility decides: private is
 * closed, follower-only opens to people who follow the owner, and unlisted and
 * public are open to anyone holding the link.
 */
export function canView(
  collection: Pick<Collection, 'visibility'>,
  role: CollectionRole | null,
  followsOwner = false,
): boolean {
  if (role !== null) return true;
  if (collection.visibility === 'private') return false;
  if (collection.visibility === 'followers') return followsOwner;
  return true;
}

/** Adding, editing, and removing items requires editor or owner. */
export function canEditItems(role: CollectionRole | null): boolean {
  return role !== null && roleAtLeast(role, 'editor');
}

/** Renaming, visibility, share links, membership, and deletion are owner-only. */
export function canManage(role: CollectionRole | null): boolean {
  return role === 'owner';
}
