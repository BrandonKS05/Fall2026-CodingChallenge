import type { NotificationListResponse } from '@wumboo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { notificationsApi } from './api';

export const INBOX_POLL_MS = 15_000;

/** Polls while the user is signed in, so activity on shared boards shows up without a reload. */
export function useInbox(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsApi.inbox(),
    enabled,
    refetchInterval: INBOX_POLL_MS,
    meta: { silentError: true },
  });
}

/** Marks the given ids read, or everything when ids is omitted. Optimistic: the badge clears at once. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids ? { ids } : {}),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationListResponse>(queryKeys.notifications);
      if (previous) {
        const now = new Date().toISOString();
        const notifications = previous.notifications.map((notification) =>
          notification.readAt === null && (!ids || ids.includes(notification.id))
            ? { ...notification, readAt: now }
            : notification,
        );
        queryClient.setQueryData<NotificationListResponse>(queryKeys.notifications, {
          notifications,
          unreadCount: notifications.filter((notification) => notification.readAt === null).length,
        });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.notifications, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
