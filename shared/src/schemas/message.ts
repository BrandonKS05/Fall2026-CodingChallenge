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

export const conversationMemberStateSchema = z.enum(['pending', 'accepted']);
export type ConversationMemberState = z.infer<typeof conversationMemberStateSchema>;

export const conversationSummarySchema = z.object({
  id: idSchema,
  /** Everyone in the conversation except the person asking. */
  participants: z.array(conversationParticipantSchema),
  /** `pending` means it is sitting in your requests, waiting for you to accept. */
  state: conversationMemberStateSchema,
  /**
   * False when there is nothing more you may send: either you have yet to accept,
   * or you have already sent the one message a request allows.
   */
  canSend: z.boolean(),
  lastMessage: z
    .object({ body: z.string(), senderId: idSchema, createdAt: timestampSchema })
    .nullable(),
  /** Sorts the list, and stays set for an empty conversation so a new one appears first. */
  lastMessageAt: timestampSchema,
  unreadCount: z.number().int().nonnegative(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

/** Which box to read: the conversations you have taken, or the ones waiting. */
export const conversationBoxSchema = z.enum(['inbox', 'requests']);
export type ConversationBox = z.infer<typeof conversationBoxSchema>;

export const conversationListQuerySchema = z.object({
  box: conversationBoxSchema.default('inbox'),
});
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema),
  /** Unread across the inbox: what the icon in the header shows. */
  unreadTotal: z.number().int().nonnegative(),
  /** How many conversations are waiting to be accepted, whichever box was asked for. */
  requestCount: z.number().int().nonnegative(),
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
