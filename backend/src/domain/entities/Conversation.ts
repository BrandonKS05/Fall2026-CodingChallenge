/** Who someone is inside a conversation: enough to show a row, no more. */
export interface ConversationParticipant {
  id: string;
  handle: string;
  displayName: string;
}

export interface Conversation {
  id: string;
  /** Set for a one-to-one conversation; null would mean a group. */
  directKey: string | null;
  lastMessageAt: Date;
  createdAt: Date;
}

/** A conversation as one member sees it: the others, the last line, their own unread count. */
export interface ConversationSummary {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: { body: string; senderId: string; createdAt: Date } | null;
  lastMessageAt: Date;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

export interface MessageDetail extends Message {
  sender: ConversationParticipant;
}

/**
 * One direct conversation per pair, whoever starts it: sorting the two ids
 * makes the key the same from both sides, and a unique index does the rest.
 */
export function directKeyFor(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}
