/**
 * Turns board events into notifications for every other member (Observer
 * subscriber), and serves the inbox. Registering with the bus is the only
 * coupling to the rest of the system.
 */
import type { NotificationDetail, NotificationType } from '../../domain/entities/Notification.js';
import type { DomainEvent } from '../../domain/events/index.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { MembershipRepository } from '../collections/ports/MembershipRepository.js';
import type { NotificationRepository } from './ports/NotificationRepository.js';

export interface NotificationServiceDeps {
  notifications: NotificationRepository;
  memberships: MembershipRepository;
  logger: Logger;
}

export interface Inbox {
  notifications: NotificationDetail[];
  unreadCount: number;
}

const INBOX_LIMIT = 50;

const TYPE_BY_EVENT: Record<DomainEvent['name'], NotificationType> = {
  'item.added': 'item_added',
  'item.updated': 'item_updated',
  'item.removed': 'item_removed',
  'collection.updated': 'collection_updated',
  'member.added': 'member_added',
};

export class NotificationService {
  private readonly log: Logger;

  constructor(private readonly deps: NotificationServiceDeps) {
    this.log = deps.logger.child({ service: 'NotificationService' });
  }

  /** Subscribes to every board event. Called once by the composition root. */
  register(bus: EventBus): void {
    for (const name of Object.keys(TYPE_BY_EVENT) as DomainEvent['name'][]) {
      bus.subscribe(name, (event) => this.handle(event));
    }
  }

  /** One notification per member other than the actor. */
  async handle(event: DomainEvent): Promise<void> {
    const { collectionId, actorId, ...rest } = event.payload;
    const recipients = (await this.deps.memberships.listMemberIds(collectionId)).filter(
      (userId) => userId !== actorId,
    );
    await this.deps.notifications.createMany(
      recipients.map((recipientId) => ({
        recipientId,
        actorId,
        collectionId,
        type: TYPE_BY_EVENT[event.name],
        payload: rest,
      })),
    );
    this.log.debug({ event: event.name, collectionId, recipients: recipients.length }, 'Notified');
  }

  async inbox(userId: string): Promise<Inbox> {
    const [notifications, unreadCount] = await Promise.all([
      this.deps.notifications.listForUser(userId, INBOX_LIMIT),
      this.deps.notifications.countUnread(userId),
    ]);
    return { notifications, unreadCount };
  }

  /** Marks the given notifications read, or all of them when ids is omitted. */
  markRead(userId: string, ids?: string[]): Promise<void> {
    return this.deps.notifications.markRead(userId, ids);
  }
}
