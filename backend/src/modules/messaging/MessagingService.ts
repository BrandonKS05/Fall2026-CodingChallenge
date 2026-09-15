/**
 * Direct messages: start a conversation with someone by their handle, read a
 * conversation, send to it. Membership is the only permission there is, so
 * every read and write checks it first and nothing else needs a role.
 */
import type { ConversationBox } from '@wumboo/shared';
import type { ConversationSummary, MessageDetail } from '../../domain/entities/Conversation.js';
import { ForbiddenError, InvalidOperationError, NotFoundError } from '../../domain/errors/index.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import type { FollowRepository } from '../social/ports/FollowRepository.js';
import type { ConversationRepository } from './ports/ConversationRepository.js';
import type { MessageBroadcaster } from './ports/MessageBroadcaster.js';
import type { ListMessagesOptions, MessageRepository } from './ports/MessageRepository.js';

export interface MessagingServiceDeps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  users: UserRepository;
  /** Decides whether a first message lands in someone's messages or their requests. */
  follows: FollowRepository;
  broadcaster: MessageBroadcaster;
  logger: Logger;
}

export interface Inbox {
  conversations: ConversationSummary[];
  unreadTotal: number;
  requestCount: number;
}

export class MessagingService {
  private readonly log: Logger;

  constructor(private readonly deps: MessagingServiceDeps) {
    this.log = deps.logger.child({ service: 'MessagingService' });
  }

  /**
   * One box at a time. The requests box holds conversations that arrived from
   * someone the person does not follow; only the inbox feeds the unread badge,
   * so a stranger cannot make the icon shout.
   */
  async inbox(userId: string, box: ConversationBox = 'inbox'): Promise<Inbox> {
    const [conversations, requestCount] = await Promise.all([
      this.deps.conversations.listForUser(userId, box === 'requests' ? 'pending' : 'accepted'),
      this.deps.conversations.countPending(userId),
    ]);
    return {
      conversations,
      unreadTotal:
        box === 'inbox' ? conversations.reduce((sum, row) => sum + row.unreadCount, 0) : 0,
      requestCount,
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
    // Someone who follows you has already said they want to hear from you; anyone
    // else arrives as a request, which they must accept before the talk is mutual.
    const conversation =
      existing ??
      (await this.deps.conversations.createDirect(
        userId,
        other.id,
        (await this.deps.follows.isFollowing(other.id, userId)) ? 'accepted' : 'pending',
      ));
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

  /**
   * Writes the message, moves the conversation to the top, and pushes it to
   * whoever is watching. A conversation the other side has not accepted allows
   * exactly one message, and the person who has not accepted cannot write at all.
   */
  async send(userId: string, conversationId: string, body: string): Promise<MessageDetail> {
    await this.requireMember(conversationId, userId);
    const summary = await this.summaryFor(conversationId, userId);
    if (summary.state === 'pending') {
      throw new InvalidOperationError('Accept this conversation before replying');
    }
    if (summary.awaitingOther && summary.lastMessage !== null) {
      throw new InvalidOperationError('You have sent your one message. Wait until they accept it.');
    }

    const message = await this.deps.messages.create({ conversationId, senderId: userId, body });
    await this.deps.conversations.touch(conversationId);

    const members = await this.deps.conversations.memberIds(conversationId);
    this.deps.broadcaster.publish(members, message);
    return message;
  }

  /** Takes a conversation out of requests, after which both sides may write freely. */
  async accept(userId: string, conversationId: string): Promise<ConversationSummary> {
    await this.requireMember(conversationId, userId);
    await this.deps.conversations.accept(conversationId, userId);
    this.log.info({ conversationId, userId }, 'Conversation accepted');
    return this.summaryFor(conversationId, userId);
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
