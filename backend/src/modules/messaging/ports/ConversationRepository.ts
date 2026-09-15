import type { Conversation, ConversationSummary } from '../../../domain/entities/Conversation.js';

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  /** The one direct conversation between two people, if it exists. */
  findDirect(userA: string, userB: string): Promise<Conversation | null>;
  /** Creates the conversation and both memberships in one transaction. */
  createDirect(userA: string, userB: string): Promise<Conversation>;
  /** Every conversation the person is in, most recently active first. */
  listForUser(userId: string): Promise<ConversationSummary[]>;
  /** One conversation as that person sees it, or null when they are not in it. */
  findSummary(conversationId: string, userId: string): Promise<ConversationSummary | null>;
  isMember(conversationId: string, userId: string): Promise<boolean>;
  memberIds(conversationId: string): Promise<string[]>;
  /** Moves the read marker to now, which is what clears the unread count. */
  markRead(conversationId: string, userId: string): Promise<void>;
  /** Bumps lastMessageAt so the inbox reorders. */
  touch(conversationId: string): Promise<void>;
}
