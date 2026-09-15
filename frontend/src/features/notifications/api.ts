import type { MarkNotificationsReadRequest, NotificationListResponse } from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const notificationsApi = {
  inbox: () => http.get<NotificationListResponse>('/notifications'),
  markRead: (body: MarkNotificationsReadRequest) => http.post<void>('/notifications/read', body),
};
