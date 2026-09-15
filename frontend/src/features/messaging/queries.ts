import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationListResponse, MessageListResponse } from '@wumboo/shared';
import { queryKeys } from '@/lib/api';
import { messagingApi } from './api';

/**
 * How often the inbox and an open conversation re-ask the server. The socket
 * layer will make these a fallback rather than the main channel; until then a
 * short poll is what makes a conversation feel live.
 */
const INBOX_INTERVAL = 15_000;
const THREAD_INTERVAL = 5_000;

/** Every conversation, with the unread total the header icon shows. */
export function useInbox(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: () => messagingApi.inbox(),
    enabled,
    refetchInterval: enabled ? INBOX_INTERVAL : false,
    meta: { silentError: true },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId ?? ''),
    queryFn: () => messagingApi.messages(conversationId ?? ''),
    enabled: Boolean(conversationId),
    refetchInterval: THREAD_INTERVAL,
    meta: { silentError: true },
  });
}

/** Opens the one conversation with a handle; asking twice is not a mistake. */
export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) => messagingApi.start(handle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
  });
}

/** Sends, and shows the line immediately: the server's copy replaces it on the next answer. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.conversations.messages(conversationId);

  return useMutation({
    mutationFn: (text: string) => messagingApi.send(conversationId, text),
    onSuccess: (message) => {
      queryClient.setQueryData<MessageListResponse>(key, (current) =>
        current ? { ...current, messages: [...current.messages, message] } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
    meta: { silentError: true },
  });
}

/** Clears the unread count, and the badge with it, without waiting for the next poll. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messagingApi.markRead(conversationId),
    onSuccess: (_result, conversationId) => {
      queryClient.setQueryData<ConversationListResponse>(
        queryKeys.conversations.list(),
        (current) =>
          current && {
            conversations: current.conversations.map((row) =>
              row.id === conversationId ? { ...row, unreadCount: 0 } : row,
            ),
            unreadTotal: current.conversations
              .filter((row) => row.id !== conversationId)
              .reduce((sum, row) => sum + row.unreadCount, 0),
          },
      );
    },
    meta: { silentError: true },
  });
}
