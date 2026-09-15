import type { MarkNotificationsReadRequest, NotificationListResponse } from '@wumboo/shared';
import { http } from '@/lib/api';

export const notificationsApi = {
  inbox: () => http.get<NotificationListResponse>('/notifications'),
  markRead: (body: MarkNotificationsReadRequest) => http.post<void>('/notifications/read', body),
};
