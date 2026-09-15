import { and, desc, eq, lt } from 'drizzle-orm';
import type { MessageDetail } from '../../../domain/entities/Conversation.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { messages, users } from '../../../infrastructure/db/schema/index.js';
import type {
  ListMessagesOptions,
  MessageRepository,
  NewMessage,
} from '../ports/MessageRepository.js';

const columns = {
  id: messages.id,
  conversationId: messages.conversationId,
  senderId: messages.senderId,
  body: messages.body,
  createdAt: messages.createdAt,
  senderHandle: users.handle,
  senderName: users.displayName,
};

type Row = { [K in keyof typeof columns]: K extends 'createdAt' ? Date : string };

const toDetail = (row: Row): MessageDetail => ({
  id: row.id,
  conversationId: row.conversationId,
  senderId: row.senderId,
  body: row.body,
  createdAt: row.createdAt,
  sender: { id: row.senderId, handle: row.senderHandle, displayName: row.senderName },
});

export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly db: Db) {}

  /**
   * Walks backwards from `before` along the conversation's sequence, the exact
   * order the index is stored in, so a page is a range scan however deep into
   * the history it sits — and never ties, so nothing is skipped or reordered.
   */
  async listByConversation(
    conversationId: string,
    { limit, before }: ListMessagesOptions,
  ): Promise<{ messages: MessageDetail[]; hasMore: boolean }> {
    const cursor = before ? await this.cursorFor(before) : null;
    const rows = await this.db
      .select(columns)
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(
        and(
          eq(messages.conversationId, conversationId),
          cursor === null ? undefined : lt(messages.seq, cursor),
        ),
      )
      .orderBy(desc(messages.seq))
      // One extra row answers "is there an older page" without a second count.
      .limit(limit + 1);

    const page = rows.slice(0, limit).map(toDetail);
    page.reverse();
    return { messages: page, hasMore: rows.length > limit };
  }

  async create(input: NewMessage): Promise<MessageDetail> {
    const [row] = await this.db.insert(messages).values(input).returning({ id: messages.id });
    if (!row) throw new Error('Insert returned no row');
    const created = await this.db
      .select(columns)
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.id, row.id))
      .limit(1);
    const detail = created[0];
    if (!detail) throw new NotFoundError('Message', row.id);
    return toDetail(detail);
  }

  /** A cursor is a message id on the wire and its sequence number underneath. */
  private async cursorFor(messageId: string): Promise<number | null> {
    const row = await this.db.query.messages.findFirst({ where: eq(messages.id, messageId) });
    return row?.seq ?? null;
  }
}
