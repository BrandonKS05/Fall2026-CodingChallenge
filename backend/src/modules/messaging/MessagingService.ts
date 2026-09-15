/**
 * Direct messages: start a conversation with someone by their handle, read a
 * conversation, send to it. Membership is the only permission there is, so
 * every read and write checks it first and nothing else needs a role.
 */
import type { ConversationSummary, MessageDetail } from '../../domain/entities/Conversation.js';
import { ForbiddenError, InvalidOperationError, NotFoundError } from '../../domain/errors/index.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import type { ConversationRepository } from './ports/ConversationRepository.js';
import type { MessageBroadcaster } from './ports/MessageBroadcaster.js';
import type { ListMessagesOptions, MessageRepository } from './ports/MessageRepository.js';

export interface MessagingServiceDeps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  users: UserRepository;
  broadcaster: MessageBroadcaster;
  logger: Logger;
}

export interface Inbox {
  conversations: ConversationSummary[];
  unreadTotal: number;
}

export class MessagingService {
  private readonly log: Logger;

  constructor(private readonly deps: MessagingServiceDeps) {
    this.log = deps.logger.child({ service: 'MessagingService' });
  }

  async inbox(userId: string): Promise<Inbox> {
    const conversations = await this.deps.conversations.listForUser(userId);
    return {
      conversations,
      unreadTotal: conversations.reduce((sum, row) => sum + row.unreadCount, 0),
    };
  }

  /**
   * Opens the conversation with a handle, creating it only the first time.
   * Asking twice gives the same conversation back, so the client can treat
   * "message this person" as a link rather than a thing that creates clutter.
   */
  async startDirect(userId: string, handle: string): Promise<ConversationSummary> {
    const other = await this.deps.users.findByHandle(handle);
    if (!other) throw new NotFoundError('User', handle);
    if (other.id === userId) {
      throw new InvalidOperationError('You cannot start a conversation with yourself');
    }

    const existing = await this.deps.conversations.findDirect(userId, other.id);
    const conversation = existing ?? (await this.deps.conversations.createDirect(userId, other.id));
    if (!existing) this.log.info({ conversationId: conversation.id }, 'Conversation started');

    return this.summaryFor(conversation.id, userId);
  }

  async listMessages(
    userId: string,
    conversationId: string,
    options: ListMessagesOptions,
  ): Promise<{ messages: MessageDetail[]; hasMore: boolean }> {
    await this.requireMember(conversationId, userId);
    return this.deps.messages.listByConversation(conversationId, options);
  }

  /** Writes the message, moves the conversation to the top, and pushes it to whoever is watching. */
  async send(userId: string, conversationId: string, body: string): Promise<MessageDetail> {
    await this.requireMember(conversationId, userId);

    const message = await this.deps.messages.create({ conversationId, senderId: userId, body });
    await this.deps.conversations.touch(conversationId);

    const members = await this.deps.conversations.memberIds(conversationId);
    this.deps.broadcaster.publish(members, message);
    return message;
  }

  /** Clears the unread count by moving the read marker to now. */
  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.requireMember(conversationId, userId);
    await this.deps.conversations.markRead(conversationId, userId);
  }

  async summaryFor(conversationId: string, userId: string): Promise<ConversationSummary> {
    const summary = await this.deps.conversations.findSummary(conversationId, userId);
    if (!summary) throw new NotFoundError('Conversation', conversationId);
    return summary;
  }

  /** A conversation you are not in reads as forbidden, never as missing content. */
  private async requireMember(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.deps.conversations.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation', conversationId);
    if (!(await this.deps.conversations.isMember(conversationId, userId))) {
      throw new ForbiddenError('This conversation is not yours');
    }
  }
}
