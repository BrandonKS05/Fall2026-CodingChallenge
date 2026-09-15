/** Presenters turn domain objects into the shapes promised by @wumboo/shared. */
import type {
  ConversationListResponse,
  ConversationSummary as ConversationSummaryDto,
  Message as MessageDto,
  MessageListResponse,
} from '@wumboo/shared';
import type { ConversationSummary, MessageDetail } from '../../domain/entities/Conversation.js';
import type { Inbox } from './MessagingService.js';

export function presentConversation(summary: ConversationSummary): ConversationSummaryDto {
  return {
    id: summary.id,
    participants: summary.participants,
    state: summary.state,
    // A request allows exactly one message, and only from the side that started it.
    canSend:
      summary.state === 'accepted' && (!summary.awaitingOther || summary.lastMessage === null),
    lastMessage: summary.lastMessage
      ? { ...summary.lastMessage, createdAt: summary.lastMessage.createdAt.toISOString() }
      : null,
    lastMessageAt: summary.lastMessageAt.toISOString(),
    unreadCount: summary.unreadCount,
  };
}

export function presentInbox(inbox: Inbox): ConversationListResponse {
  return {
    conversations: inbox.conversations.map(presentConversation),
    unreadTotal: inbox.unreadTotal,
    requestCount: inbox.requestCount,
  };
}

export function presentMessage(message: MessageDetail): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.body,
    sender: message.sender,
    createdAt: message.createdAt.toISOString(),
  };
}

export function presentMessages(page: {
  messages: MessageDetail[];
  hasMore: boolean;
}): MessageListResponse {
  return { messages: page.messages.map(presentMessage), hasMore: page.hasMore };
}
