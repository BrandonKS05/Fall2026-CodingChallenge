import type { DomainEvent, DomainEventName, EventOf } from '../domain/events/index.js';

export type EventHandler<TName extends DomainEventName> = (
  event: EventOf<TName>,
) => Promise<void> | void;

/**
 * Observer port. In-process today; the same interface could sit in front of
 * a queue tomorrow without touching publishers or subscribers.
 */
export interface EventBus {
  /** Resolves once every handler has run. Handler failures are logged, never propagated. */
  publish(event: DomainEvent): Promise<void>;
  /** Returns a function that removes the subscription. */
  subscribe<TName extends DomainEventName>(name: TName, handler: EventHandler<TName>): () => void;
}
