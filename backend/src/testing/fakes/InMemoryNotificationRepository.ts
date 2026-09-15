import { randomUUID } from 'node:crypto';
import type { Notification, NotificationDetail } from '../../domain/entities/Notification.js';
import type {
  NewNotification,
  NotificationRepository,
} from '../../modules/notifications/ports/NotificationRepository.js';
import type { InMemoryCollectionRepository } from './InMemoryCollectionRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

export class InMemoryNotificationRepository implements NotificationRepository {
  readonly rows: Notification[] = [];

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly collections: InMemoryCollectionRepository,
  ) {}

  async createMany(inputs: NewNotification[]): Promise<void> {
    for (const input of inputs) {
      this.rows.push({ id: randomUUID(), ...input, readAt: null, createdAt: new Date() });
    }
  }

  async listForUser(userId: string, limit: number): Promise<NotificationDetail[]> {
    const mine = this.rows
      .filter((row) => row.recipientId === userId)
      .reverse()
      .slice(0, limit);
    return Promise.all(
      mine.map(async (row) => ({
        ...row,
        actorHandle: (await this.users.findById(row.actorId))?.handle ?? '',
        actorDisplayName: (await this.users.findById(row.actorId))?.displayName ?? '',
        collectionTitle: (await this.collections.findById(row.collectionId))?.title ?? '',
      })),
    );
  }

  async countUnread(userId: string): Promise<number> {
    return this.rows.filter((row) => row.recipientId === userId && row.readAt === null).length;
  }

  async markRead(userId: string, ids?: string[]): Promise<void> {
    for (const row of this.rows) {
      if (row.recipientId !== userId || row.readAt !== null) continue;
      if (ids && !ids.includes(row.id)) continue;
      row.readAt = new Date();
    }
  }
}
