/**
 * Turns board events into notifications for every other member (Observer
 * subscriber), and serves the inbox. Registering with the bus is the only
 * coupling to the rest of the system.
 */
import type { NotificationDetail, NotificationType } from '../../domain/entities/Notification.js';
import type { BoardEvent, BoardEventName } from '../../domain/events/index.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { NotificationPreferences } from '@wumboo/shared';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import type { MembershipRepository } from '../collections/ports/MembershipRepository.js';
import type { NotificationRepository } from './ports/NotificationRepository.js';

export interface NotificationServiceDeps {
  notifications: NotificationRepository;
  memberships: MembershipRepository;
  users: UserRepository;
  logger: Logger;
}

export interface Inbox {
  notifications: NotificationDetail[];
  unreadCount: number;
}

const INBOX_LIMIT = 50;

const TYPE_BY_EVENT: Record<BoardEventName, BoardNotificationType> = {
  'item.added': 'item_added',
  'item.updated': 'item_updated',
  'item.removed': 'item_removed',
  'collection.updated': 'collection_updated',
  'member.added': 'member_added',
  'collection.liked': 'collection_liked',
};

/**
 * Which switch in a person's settings governs which kind of notification.
 * A welcome has no switch: it arrives once, before there is anything to
 * have an opinion about.
 */
const SWITCH_FOR: Record<BoardNotificationType, keyof NotificationPreferences> = {
  item_added: 'itemAdded',
  item_updated: 'itemUpdated',
  item_removed: 'itemRemoved',
  collection_updated: 'collectionUpdated',
  member_added: 'memberAdded',
  collection_liked: 'collectionLiked',
};

type BoardNotificationType = Exclude<NotificationType, 'welcome'>;

export class NotificationService {
  private readonly log: Logger;

  constructor(private readonly deps: NotificationServiceDeps) {
    this.log = deps.logger.child({ service: 'NotificationService' });
  }

  /** Subscribes to everything worth telling somebody about. Called once by the composition root. */
  register(bus: EventBus): void {
    for (const name of Object.keys(TYPE_BY_EVENT) as BoardEventName[]) {
      bus.subscribe(name, (event) => this.handle(event));
    }
    bus.subscribe('user.joined', (event) => this.welcome(event.payload.userId));
  }

  /**
   * The first thing in anybody's inbox. It comes from nobody and is about no
   * board, which is why a notification is allowed to have neither.
   */
  async welcome(userId: string): Promise<void> {
    await this.deps.notifications.createMany([
      {
        recipientId: userId,
        actorId: null,
        collectionId: null,
        type: 'welcome',
        payload: {},
      },
    ]);
    this.log.info({ userId }, 'Welcomed a new account');
  }

  /**
   * One notification per member other than the actor; a like goes to the owner
   * alone. Everyone's own settings decide whether their copy is written at all,
   * so a switch that is off means nothing arrives, not something hidden later.
   */
  async handle(event: BoardEvent): Promise<void> {
    const { collectionId, actorId, ...rest } = event.payload;
    const audience =
      event.name === 'collection.liked'
        ? [event.payload.ownerId]
        : await this.deps.memberships.listMemberIds(collectionId);
    const others = audience.filter((userId) => userId !== actorId);

    const type = TYPE_BY_EVENT[event.name];
    const settings = await this.deps.users.findPreferences(others);
    const recipients = others.filter(
      (userId) => settings.get(userId)?.notifications[SWITCH_FOR[type]] !== false,
    );

    await this.deps.notifications.createMany(
      recipients.map((recipientId) => ({
        recipientId,
        actorId,
        collectionId,
        type,
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
