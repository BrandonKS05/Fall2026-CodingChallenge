import type { Notification as NotificationDto, NotificationListResponse } from '@trove/shared';
import type { NotificationDetail } from '../../domain/entities/Notification.js';
import type { Inbox } from '../../services/NotificationService.js';

export function presentNotification(detail: NotificationDetail): NotificationDto {
  return {
    id: detail.id,
    type: detail.type,
    collection: { id: detail.collectionId, title: detail.collectionTitle },
    actor: { id: detail.actorId, displayName: detail.actorDisplayName },
    payload: detail.payload,
    readAt: detail.readAt?.toISOString() ?? null,
    createdAt: detail.createdAt.toISOString(),
  };
}

export function presentInbox(inbox: Inbox): NotificationListResponse {
  return {
    notifications: inbox.notifications.map(presentNotification),
    unreadCount: inbox.unreadCount,
  };
}
