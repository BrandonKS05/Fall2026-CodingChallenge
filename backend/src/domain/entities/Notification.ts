export const NOTIFICATION_TYPES = [
  'item_added',
  'item_removed',
  'item_updated',
  'collection_updated',
  'member_added',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  recipientId: string;
  actorId: string;
  collectionId: string;
  type: NotificationType;
  /** Type-specific extras, e.g. { itemCount: 3 }. */
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/** Read model for the notification list. */
export interface NotificationDetail extends Notification {
  actorDisplayName: string;
  collectionTitle: string;
}
