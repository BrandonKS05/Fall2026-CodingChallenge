/**
 * Direct messages. A conversation holds members and messages; the client only
 * ever sees a conversation as the viewer sees it, which is why the summary
 * carries the other participants and the viewer's own unread count.
 */
import { z } from 'zod';
import { handleSchema } from './auth.js';
import { idSchema, timestampSchema } from './common.js';

/** Who someone is in a conversation: enough to show a row and open their profile. */
export const conversationParticipantSchema = z.object({
  id: idSchema,
  handle: z.string(),
  displayName: z.string(),
});
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;

export const MESSAGE_MAX_LENGTH = 2000;

export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  body: z.string(),
  sender: conversationParticipantSchema,
  createdAt: timestampSchema,
});
export type Message = z.infer<typeof messageSchema>;

export const conversationSummarySchema = z.object({
  id: idSchema,
  /** Everyone in the conversation except the person asking. */
  participants: z.array(conversationParticipantSchema),
  lastMessage: z
    .object({ body: z.string(), senderId: idSchema, createdAt: timestampSchema })
    .nullable(),
  /** Sorts the list, and stays set for an empty conversation so a new one appears first. */
  lastMessageAt: timestampSchema,
  unreadCount: z.number().int().nonnegative(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
  /** Across every conversation: what the icon in the header shows. */
  unreadTotal: z.number().int().nonnegative(),
});
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;

/** POST /conversations: start (or reopen) the one direct conversation with someone. */
export const startConversationRequestSchema = z.object({ handle: handleSchema });
export type StartConversationRequest = z.infer<typeof startConversationRequestSchema>;

/** Keyset pagination: `before` is the oldest message already on screen. */
export const messagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: idSchema.optional(),
});
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

export const messageListResponseSchema = z.object({
  /** Oldest first, the order they are read in. */
  messages: z.array(messageSchema),
  /** True when an older page exists behind this one. */
  hasMore: z.boolean(),
});
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;

export const sendMessageRequestSchema = z.object({
  text: z.string().trim().min(1, 'Say something first').max(MESSAGE_MAX_LENGTH),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
