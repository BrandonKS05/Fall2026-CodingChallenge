import type { MarkNotificationsReadRequest, NotificationListResponse } from '@trove/shared';
import { http } from '@/lib/api';

export const notificationsApi = {
  inbox: () => http.get<NotificationListResponse>('/notifications'),
  markRead: (body: MarkNotificationsReadRequest) => http.post<void>('/notifications/read', body),
};
