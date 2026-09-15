/**
 * Domain events describe things that happened to a board. Services publish
 * them; listeners such as notifications react. Publishers never know who is
 * listening, which is what keeps notifications out of the item and board code.
 */
import type { CollectionRole } from '../entities/Membership.js';

interface BaseEvent<TName extends string, TPayload> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

interface BoardActivity {
  collectionId: string;
  actorId: string;
}

export type ItemAddedEvent = BaseEvent<
  'item.added',
  BoardActivity & { itemId: string; imageId: string }
>;
export type ItemUpdatedEvent = BaseEvent<
  'item.updated',
  BoardActivity & { itemId: string; moved: boolean }
>;
export type ItemRemovedEvent = BaseEvent<'item.removed', BoardActivity & { itemId: string }>;
export type CollectionUpdatedEvent = BaseEvent<
  'collection.updated',
  BoardActivity & { changes: string[] }
>;
export type MemberAddedEvent = BaseEvent<
  'member.added',
  BoardActivity & { userId: string; role: CollectionRole }
>;
/** Carries the owner, because a like is news for the owner rather than for every member. */
export type CollectionLikedEvent = BaseEvent<
  'collection.liked',
  BoardActivity & { ownerId: string }
>;

export type DomainEvent =
  | ItemAddedEvent
  | ItemUpdatedEvent
  | ItemRemovedEvent
  | CollectionUpdatedEvent
  | MemberAddedEvent
  | CollectionLikedEvent;

export type DomainEventName = DomainEvent['name'];
export type EventOf<TName extends DomainEventName> = Extract<DomainEvent, { name: TName }>;

export function createEvent<TName extends DomainEventName>(
  name: TName,
  payload: EventOf<TName>['payload'],
): EventOf<TName> {
  return { name, payload, occurredAt: new Date() } as EventOf<TName>;
}
