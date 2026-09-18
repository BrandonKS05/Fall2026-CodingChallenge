/**
 * Notifications contract. Produced on the backend by an event listener whenever
 * a shared collection changes; consumed by the bell in the frontend.
 */
import { z } from 'zod';
import { idSchema, timestampSchema, userSummarySchema } from './common.js';

export const notificationTypeSchema = z.enum([
  'welcome',
  'item_added',
  'item_removed',
  'item_updated',
  'collection_updated',
  'member_added',
  'collection_liked',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: idSchema,
  type: notificationTypeSchema,
  /** Null for a welcome, which is about the place rather than one board. */
  collection: z.object({ id: idSchema, title: z.string() }).nullable(),
  /** Null when nobody did it. */
  actor: userSummarySchema.nullable(),
  /** Type-specific extras, e.g. { itemCount: 3 } for a batch of item_added. */
  payload: z.record(z.string(), z.unknown()),
  readAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

/** Omit ids to mark everything as read. */
export const markNotificationsReadRequestSchema = z.object({
  ids: z.array(idSchema).min(1).optional(),
});
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;
