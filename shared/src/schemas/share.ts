/**
 * Sharing contract: share links for anyone-with-the-link access, and
 * memberships for account-based collaboration.
 */
import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';
import { emailSchema } from './auth.js';
import { collectionRoleSchema } from './collection.js';

/** Roles that can be granted. Ownership is never transferred through this API. */
export const grantableRoleSchema = collectionRoleSchema.exclude(['owner']);
export type GrantableRole = z.infer<typeof grantableRoleSchema>;

export const inviteMemberRequestSchema = z.object({
  email: emailSchema,
  role: grantableRoleSchema.default('editor'),
});
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;

export const updateMemberRequestSchema = z.object({
  role: grantableRoleSchema,
});
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;

export const memberSchema = z.object({
  userId: idSchema,
  /** Null for a member who signed up by phone. */
  email: z.email().nullable(),
  displayName: z.string(),
  role: collectionRoleSchema,
  joinedAt: timestampSchema,
});
export type Member = z.infer<typeof memberSchema>;

export const memberListResponseSchema = z.object({
  members: z.array(memberSchema),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;

/** The frontend builds the full URL from the slug so the API stays host-agnostic. */
export const shareLinkResponseSchema = z.object({
  slug: z.string(),
});
export type ShareLinkResponse = z.infer<typeof shareLinkResponseSchema>;
