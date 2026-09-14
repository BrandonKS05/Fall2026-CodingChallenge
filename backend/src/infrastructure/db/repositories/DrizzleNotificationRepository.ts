import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NotificationDetail } from '../../../domain/entities/Notification.js';
import type {
  NewNotification,
  NotificationRepository,
} from '../../../ports/repositories/NotificationRepository.js';
import type { Db } from '../client.js';
import { collections, notifications, users } from '../schema/index.js';

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Db) {}

  async createMany(inputs: NewNotification[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.db.insert(notifications).values(inputs);
  }

  async listForUser(userId: string, limit: number): Promise<NotificationDetail[]> {
    const rows = await this.db
      .select({
        id: notifications.id,
        recipientId: notifications.recipientId,
        actorId: notifications.actorId,
        collectionId: notifications.collectionId,
        type: notifications.type,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorDisplayName: users.displayName,
        collectionTitle: collections.title,
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.actorId))
      .innerJoin(collections, eq(collections.id, notifications.collectionId))
      .where(eq(notifications.recipientId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows;
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, userId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  }

  async markRead(userId: string, ids?: string[]): Promise<void> {
    if (ids?.length === 0) return;
    await this.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notifications.recipientId, userId),
          isNull(notifications.readAt),
          ids ? inArray(notifications.id, ids) : undefined,
        ),
      );
  }
}
