import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type {
  Conversation,
  ConversationMemberState,
  ConversationParticipant,
  ConversationSummary,
} from '../../../domain/entities/Conversation.js';
import { directKeyFor } from '../../../domain/entities/Conversation.js';
import { ConflictError } from '../../../domain/errors/index.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { isUniqueViolation } from '../../../infrastructure/db/errors.js';
import {
  conversationMembers,
  conversations,
  messages,
  users,
} from '../../../infrastructure/db/schema/index.js';
import type { ConversationRepository } from '../ports/ConversationRepository.js';

type ConversationRow = typeof conversations.$inferSelect;

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  directKey: row.directKey,
  lastMessageAt: row.lastMessageAt,
  createdAt: row.createdAt,
});

/** The last line of a conversation, as one JSON value so it costs one subquery. */
const lastMessage = sql<{ body: string; senderId: string; createdAt: string } | null>`(
  select json_build_object('body', m.body, 'senderId', m.sender_id, 'createdAt', m.created_at)
  from ${messages} m
  where m.conversation_id = ${conversations.id}
  order by m.created_at desc, m.id desc
  limit 1
)`;

/** True while anyone else in the conversation has yet to accept it. */
const awaitingOther = sql<boolean>`exists (
  select 1 from ${conversationMembers} other
  where other.conversation_id = ${conversations.id}
    and other.user_id <> ${conversationMembers.userId}
    and other.state = 'pending'
)`;

/** Anything the other people said after this member last looked. */
const unreadCount = sql<number>`(
  select count(*)::int
  from ${messages} m
  where m.conversation_id = ${conversations.id}
    and m.sender_id <> ${conversationMembers.userId}
    and m.created_at > ${conversationMembers.lastReadAt}
)`;

/** The one row shape both listings read, so they cannot drift apart. */
const summaryColumns = {
  id: conversations.id,
  lastMessageAt: conversations.lastMessageAt,
  state: conversationMembers.state,
  awaitingOther,
  lastMessage,
  unreadCount,
};

type SummaryRow = {
  id: string;
  lastMessageAt: Date;
  state: ConversationMemberState;
  awaitingOther: boolean;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
};

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Conversation | null> {
    const row = await this.db.query.conversations.findFirst({ where: eq(conversations.id, id) });
    return row ? toConversation(row) : null;
  }

  async findDirect(userA: string, userB: string): Promise<Conversation | null> {
    const row = await this.db.query.conversations.findFirst({
      where: eq(conversations.directKey, directKeyFor(userA, userB)),
    });
    return row ? toConversation(row) : null;
  }

  /**
   * Both memberships or neither: a conversation with one member is not a
   * conversation. The initiator is accepted at once; the other side lands
   * wherever the caller says, which is what makes a request a request.
   */
  async createDirect(
    initiatorId: string,
    recipientId: string,
    recipientState: ConversationMemberState,
  ): Promise<Conversation> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(conversations)
          .values({ directKey: directKeyFor(initiatorId, recipientId) })
          .returning();
        if (!row) throw new Error('Insert returned no row');
        await tx.insert(conversationMembers).values([
          { conversationId: row.id, userId: initiatorId, state: 'accepted' },
          { conversationId: row.id, userId: recipientId, state: recipientState },
        ]);
        return toConversation(row);
      });
    } catch (error) {
      if (isUniqueViolation(error, 'conversations_direct_key_unique')) {
        // Someone else opened the same conversation first; theirs is just as good.
        const existing = await this.findDirect(initiatorId, recipientId);
        if (existing) return existing;
        throw new ConflictError('That conversation already exists');
      }
      throw error;
    }
  }

  async listForUser(
    userId: string,
    state: ConversationMemberState,
  ): Promise<ConversationSummary[]> {
    const rows = await this.db
      .select(summaryColumns)
      .from(conversations)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, conversations.id),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(eq(conversationMembers.state, state))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.id));

    return this.withParticipants(rows, userId);
  }

  async countPending(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.userId, userId), eq(conversationMembers.state, 'pending')));
    return row?.count ?? 0;
  }

  async memberState(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMemberState | null> {
    const row = await this.db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    });
    return row?.state ?? null;
  }

  async accept(conversationId: string, userId: string): Promise<void> {
    await this.db
      .update(conversationMembers)
      .set({ state: 'accepted' })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      );
  }

  async findSummary(conversationId: string, userId: string): Promise<ConversationSummary | null> {
    const rows = await this.db
      .select(summaryColumns)
      .from(conversations)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, conversations.id),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(eq(conversations.id, conversationId))
      .limit(1);

    return (await this.withParticipants(rows, userId))[0] ?? null;
  }

  /** One extra query for everyone in the listed conversations, rather than one per row. */
  private async withParticipants(
    rows: SummaryRow[],
    viewerId: string,
  ): Promise<ConversationSummary[]> {
    if (rows.length === 0) return [];
    const memberRows = await this.db
      .select({
        conversationId: conversationMembers.conversationId,
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
      })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(
        and(
          inArray(
            conversationMembers.conversationId,
            rows.map((row) => row.id),
          ),
          ne(conversationMembers.userId, viewerId),
        ),
      );

    const byConversation = new Map<string, ConversationParticipant[]>();
    for (const { conversationId, ...participant } of memberRows) {
      byConversation.set(conversationId, [
        ...(byConversation.get(conversationId) ?? []),
        participant,
      ]);
    }

    return rows.map((row) => ({
      id: row.id,
      participants: byConversation.get(row.id) ?? [],
      state: row.state,
      awaitingOther: row.awaitingOther,
      lastMessage: row.lastMessage
        ? { ...row.lastMessage, createdAt: new Date(row.lastMessage.createdAt) }
        : null,
      lastMessageAt: row.lastMessageAt,
      unreadCount: row.unreadCount,
    }));
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const row = await this.db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ),
    });
    return row !== undefined;
  }

  async memberIds(conversationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    return rows.map((row) => row.userId);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.db
      .update(conversationMembers)
      .set({ lastReadAt: sql`now()` })
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      );
  }

  async touch(conversationId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ lastMessageAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(conversations.id, conversationId));
  }
}
