import { randomUUID } from 'node:crypto';
import type { MessageDetail } from '../../domain/entities/Conversation.js';
import { NotFoundError } from '../../domain/errors/index.js';
import type {
  ListMessagesOptions,
  MessageRepository,
  NewMessage,
} from '../../modules/messaging/ports/MessageRepository.js';
import { nextInstant } from './clock.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

/** Port-conformant fake, including the keyset page and its hasMore flag. */
export class InMemoryMessageRepository implements MessageRepository {
  private readonly rows: MessageDetail[] = [];

  constructor(private readonly users: InMemoryUserRepository) {}

  /** Test helper: one conversation's history, oldest first. */
  forConversation(conversationId: string): MessageDetail[] {
    return this.rows.filter((row) => row.conversationId === conversationId);
  }

  async listByConversation(
    conversationId: string,
    { limit, before }: ListMessagesOptions,
  ): Promise<{ messages: MessageDetail[]; hasMore: boolean }> {
    const history = this.forConversation(conversationId);
    const end = before ? history.findIndex((row) => row.id === before) : history.length;
    const upTo = end === -1 ? history.length : end;
    const start = Math.max(0, upTo - limit);
    return { messages: history.slice(start, upTo), hasMore: start > 0 };
  }

  async create(input: NewMessage): Promise<MessageDetail> {
    const sender = await this.users.findById(input.senderId);
    if (!sender) throw new NotFoundError('User', input.senderId);
    const message: MessageDetail = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body,
      createdAt: nextInstant(),
      sender: { id: sender.id, handle: sender.handle, displayName: sender.displayName },
    };
    this.rows.push(message);
    return message;
  }
}
