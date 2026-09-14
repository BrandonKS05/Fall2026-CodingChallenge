import type { Notification, NotificationDetail } from '../../../domain/entities/Notification.js';

export type NewNotification = Omit<Notification, 'id' | 'readAt' | 'createdAt'>;

export interface NotificationRepository {
  createMany(inputs: NewNotification[]): Promise<void>;
  /** Newest first. */
  listForUser(userId: string, limit: number): Promise<NotificationDetail[]>;
  countUnread(userId: string): Promise<number>;
  /** Marks the given ids read, or every notification of the user when ids is omitted. */
  markRead(userId: string, ids?: string[]): Promise<void>;
}
