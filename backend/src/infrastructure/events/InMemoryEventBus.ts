import type { DomainEvent, DomainEventName } from '../../domain/events/index.js';
import type { EventBus, EventHandler } from '../../ports/EventBus.js';
import type { Logger } from '../../ports/Logger.js';

type AnyHandler = (event: DomainEvent) => Promise<void> | void;

/**
 * Observer implementation for a single process. Handlers run concurrently
 * and independently: one failing listener is logged and never blocks the
 * others or the publisher.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<DomainEventName, Set<AnyHandler>>();
  private readonly log: Logger;

  constructor(logger: Logger) {
    this.log = logger.child({ component: 'EventBus' });
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = [...(this.handlers.get(event.name) ?? [])];
    const outcomes = await Promise.allSettled(handlers.map((handler) => handler(event)));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        this.log.error({ err: outcome.reason, event: event.name }, 'Event handler failed');
      }
    }
  }

  subscribe<TName extends DomainEventName>(name: TName, handler: EventHandler<TName>): () => void {
    const set = this.handlers.get(name) ?? new Set<AnyHandler>();
    const anyHandler = handler as unknown as AnyHandler;
    set.add(anyHandler);
    this.handlers.set(name, set);
    return () => {
      set.delete(anyHandler);
    };
  }
}
