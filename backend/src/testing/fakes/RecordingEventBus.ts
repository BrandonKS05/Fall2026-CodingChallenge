import type { DomainEvent, DomainEventName } from '../../domain/events/index.js';
import type { EventBus, EventHandler } from '../../infrastructure/events/EventBus.js';

type AnyHandler = (event: DomainEvent) => Promise<void> | void;

/** Dispatches like the real bus and keeps every published event for assertions. */
export class RecordingEventBus implements EventBus {
  readonly published: DomainEvent[] = [];
  private readonly handlers = new Map<DomainEventName, Set<AnyHandler>>();

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
    await Promise.all([...(this.handlers.get(event.name) ?? [])].map((handler) => handler(event)));
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

  names(): DomainEventName[] {
    return this.published.map((event) => event.name);
  }
}
