import type {
  ConversationBox,
  ConversationListResponse,
  ConversationSummary,
  Message,
  MessageListResponse,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const messagingApi = {
  inbox: (box: ConversationBox) =>
    http.get<ConversationListResponse>('/conversations', { query: { box } }),
  start: (handle: string) => http.post<ConversationSummary>('/conversations', { handle }),
  messages: (conversationId: string, params: { limit?: number; before?: string } = {}) =>
    http.get<MessageListResponse>(`/conversations/${conversationId}/messages`, { query: params }),
  send: (conversationId: string, text: string) =>
    http.post<Message>(`/conversations/${conversationId}/messages`, { text }),
  markRead: (conversationId: string) => http.post<void>(`/conversations/${conversationId}/read`),
  accept: (conversationId: string) =>
    http.post<ConversationSummary>(`/conversations/${conversationId}/accept`),
};
