import type { MessageDetail } from '../../../domain/entities/Conversation.js';

export interface ListMessagesOptions {
  limit: number;
  /** Keyset cursor: the id of the oldest message already on screen. */
  before?: string | undefined;
}

export interface NewMessage {
  conversationId: string;
  senderId: string;
  body: string;
}

export interface MessageRepository {
  /** One page, newest first, so the caller can tell whether an older page exists. */
  listByConversation(
    conversationId: string,
    options: ListMessagesOptions,
  ): Promise<{ messages: MessageDetail[]; hasMore: boolean }>;
  create(input: NewMessage): Promise<MessageDetail>;
  /** How many messages the conversation holds, which is what rations a request's opener. */
  countByConversation(conversationId: string): Promise<number>;
}
