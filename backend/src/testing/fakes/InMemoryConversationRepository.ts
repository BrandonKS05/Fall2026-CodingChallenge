import { randomUUID } from 'node:crypto';
import type {
  Conversation,
  ConversationMemberState,
  ConversationSummary,
} from '../../domain/entities/Conversation.js';
import { directKeyFor } from '../../domain/entities/Conversation.js';
import type { ConversationRepository } from '../../modules/messaging/ports/ConversationRepository.js';
import { nextInstant } from './clock.js';
import type { InMemoryMessageRepository } from './InMemoryMessageRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

interface Membership {
  conversationId: string;
  userId: string;
  state: ConversationMemberState;
  lastReadAt: Date;
}

/** Port-conformant fake. Unread counts and the last line come from the messages fake, as the SQL does. */
export class InMemoryConversationRepository implements ConversationRepository {
  private readonly rows = new Map<string, Conversation>();
  private readonly members: Membership[] = [];

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly messages: InMemoryMessageRepository,
  ) {}

  async findById(id: string): Promise<Conversation | null> {
    return this.rows.get(id) ?? null;
  }

  async findDirect(userA: string, userB: string): Promise<Conversation | null> {
    const key = directKeyFor(userA, userB);
    return [...this.rows.values()].find((row) => row.directKey === key) ?? null;
  }

  async createDirect(
    initiatorId: string,
    recipientId: string,
    recipientState: ConversationMemberState,
  ): Promise<Conversation> {
    const now = nextInstant();
    const conversation: Conversation = {
      id: randomUUID(),
      directKey: directKeyFor(initiatorId, recipientId),
      lastMessageAt: now,
      createdAt: now,
    };
    this.rows.set(conversation.id, conversation);
    this.members.push(
      { conversationId: conversation.id, userId: initiatorId, state: 'accepted', lastReadAt: now },
      {
        conversationId: conversation.id,
        userId: recipientId,
        state: recipientState,
        lastReadAt: now,
      },
    );
    return conversation;
  }

  async countPending(userId: string): Promise<number> {
    return this.members.filter((member) => member.userId === userId && member.state === 'pending')
      .length;
  }

  async memberState(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMemberState | null> {
    return this.memberRow(conversationId, userId)?.state ?? null;
  }

  async accept(conversationId: string, userId: string): Promise<void> {
    const member = this.memberRow(conversationId, userId);
    if (member) member.state = 'accepted';
  }

  async listForUser(
    userId: string,
    state: ConversationMemberState,
  ): Promise<ConversationSummary[]> {
    const mine = this.members.filter(
      (member) => member.userId === userId && member.state === state,
    );
    const summaries = await Promise.all(mine.map((member) => this.summarize(member)));
    return summaries.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async findSummary(conversationId: string, userId: string): Promise<ConversationSummary | null> {
    const member = this.memberRow(conversationId, userId);
    return member ? this.summarize(member) : null;
  }

  private async summarize(member: Membership): Promise<ConversationSummary> {
    const conversation = this.rows.get(member.conversationId);
    const history = this.messages.forConversation(member.conversationId);
    const last = history.at(-1);
    const others = this.members.filter(
      (row) => row.conversationId === member.conversationId && row.userId !== member.userId,
    );
    const participants = [];
    for (const other of others) {
      const user = await this.users.findById(other.userId);
      if (user) {
        participants.push({ id: user.id, handle: user.handle, displayName: user.displayName });
      }
    }

    return {
      id: member.conversationId,
      participants,
      state: member.state,
      awaitingOther: others.some((row) => row.state === 'pending'),
      lastMessage: last
        ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt }
        : null,
      lastMessageAt: conversation?.lastMessageAt ?? new Date(0),
      unreadCount: history.filter(
        (message) => message.senderId !== member.userId && message.createdAt > member.lastReadAt,
      ).length,
    };
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    return this.memberRow(conversationId, userId) !== undefined;
  }

  async memberIds(conversationId: string): Promise<string[]> {
    return this.members
      .filter((member) => member.conversationId === conversationId)
      .map((member) => member.userId);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    const member = this.memberRow(conversationId, userId);
    if (member) member.lastReadAt = nextInstant();
  }

  async touch(conversationId: string): Promise<void> {
    const conversation = this.rows.get(conversationId);
    if (conversation) {
      this.rows.set(conversationId, { ...conversation, lastMessageAt: nextInstant() });
    }
  }

  private memberRow(conversationId: string, userId: string): Membership | undefined {
    return this.members.find(
      (member) => member.conversationId === conversationId && member.userId === userId,
    );
  }
}
