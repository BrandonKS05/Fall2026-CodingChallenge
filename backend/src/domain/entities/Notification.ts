export const NOTIFICATION_TYPES = [
  'welcome',
  'item_added',
  'item_removed',
  'item_updated',
  'collection_updated',
  'member_added',
  'collection_liked',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  recipientId: string;
  /**
   * Who did it, and which board it happened on. Both are null for a welcome:
   * nobody did it, and it is about the whole place rather than one board.
   */
  actorId: string | null;
  collectionId: string | null;
  type: NotificationType;
  /** Type-specific extras, e.g. { itemCount: 3 }. */
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/** Read model for the notification list. */
export interface NotificationDetail extends Notification {
  actorHandle: string | null;
  actorDisplayName: string | null;
  collectionTitle: string | null;
}
