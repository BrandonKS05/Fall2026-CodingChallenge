import type {
  Conversation,
  ConversationMemberState,
  ConversationSummary,
} from '../../../domain/entities/Conversation.js';

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  /** The one direct conversation between two people, if it exists. */
  findDirect(userA: string, userB: string): Promise<Conversation | null>;
  /**
   * Creates the conversation and both memberships in one transaction. The
   * initiator is accepted at once; `recipientState` decides whether it lands in
   * the other person's messages or in their requests.
   */
  createDirect(
    initiatorId: string,
    recipientId: string,
    recipientState: ConversationMemberState,
  ): Promise<Conversation>;
  /** One box of conversations, most recently active first. */
  listForUser(userId: string, state: ConversationMemberState): Promise<ConversationSummary[]>;
  /** How many conversations are waiting for this person to accept. */
  countPending(userId: string): Promise<number>;
  /** Where the conversation sits for this person, or null when they are not in it. */
  memberState(conversationId: string, userId: string): Promise<ConversationMemberState | null>;
  /** Takes a conversation out of the person's requests. */
  accept(conversationId: string, userId: string): Promise<void>;
  /** One conversation as that person sees it, or null when they are not in it. */
  findSummary(conversationId: string, userId: string): Promise<ConversationSummary | null>;
  isMember(conversationId: string, userId: string): Promise<boolean>;
  memberIds(conversationId: string): Promise<string[]>;
  /** Moves the read marker to now, which is what clears the unread count. */
  markRead(conversationId: string, userId: string): Promise<void>;
  /** Bumps lastMessageAt so the inbox reorders. */
  touch(conversationId: string): Promise<void>;
}
