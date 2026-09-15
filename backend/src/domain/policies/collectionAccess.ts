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

/** Members can always view. Non-members can view anything that is not private. */
export function canView(
  collection: Pick<Collection, 'visibility'>,
  role: CollectionRole | null,
): boolean {
  return role !== null || collection.visibility !== 'private';
}

/** Adding, editing, and removing items requires editor or owner. */
export function canEditItems(role: CollectionRole | null): boolean {
  return role !== null && roleAtLeast(role, 'editor');
}

/** Renaming, visibility, share links, membership, and deletion are owner-only. */
export function canManage(role: CollectionRole | null): boolean {
  return role === 'owner';
}
