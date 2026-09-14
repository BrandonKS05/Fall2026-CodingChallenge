import { describe, expect, it, vi } from 'vitest';
import { createEvent } from '../../domain/events/index.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { InMemoryEventBus } from './InMemoryEventBus.js';

const added = () =>
  createEvent('item.added', { collectionId: 'c1', actorId: 'u1', itemId: 'i1', imageId: 'img1' });

describe('InMemoryEventBus', () => {
  it('delivers events to subscribers of that name only, until they unsubscribe', async () => {
    const bus = new InMemoryEventBus(silentLogger);
    const onAdded = vi.fn();
    const onRemoved = vi.fn();
    const stop = bus.subscribe('item.added', onAdded);
    bus.subscribe('item.removed', onRemoved);

    const event = added();
    await bus.publish(event);
    expect(onAdded).toHaveBeenCalledWith(event);
    expect(onRemoved).not.toHaveBeenCalled();

    stop();
    await bus.publish(added());
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it('isolates a failing handler from the publisher and from other handlers', async () => {
    const bus = new InMemoryEventBus(silentLogger);
    const healthy = vi.fn();
    bus.subscribe('item.added', async () => {
      throw new Error('listener exploded');
    });
    bus.subscribe('item.added', healthy);

    await expect(bus.publish(added())).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
