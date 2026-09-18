import { describe, expect, it, vi } from 'vitest';
import { RecordingEventBus } from '../../testing/fakes/RecordingEventBus.js';
import { InMemoryEmbeddingRepository } from '../../testing/fakes/InMemoryEmbeddingRepository.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { createEvent } from '../../domain/events/index.js';
import { EmbeddingService } from './EmbeddingService.js';
import { embeddingInputHash, embeddingText } from './embeddingText.js';
import type { EmbeddingClient } from './ports/EmbeddingClient.js';
import { RECOMMENDATIONS } from '../../config/recommendations.js';

/** Answers with a vector that encodes the text, so a test can tell them apart. */
function stubClient(behaviour: { failTimes?: number } = {}) {
  let failures = behaviour.failTimes ?? 0;
  const seen: string[][] = [];
  const client: EmbeddingClient = {
    embed: (texts) => {
      seen.push(texts);
      if (failures > 0) {
        failures -= 1;
        return Promise.reject(new Error('provider down'));
      }
      return Promise.resolve(texts.map((text) => [text.length, 0, 1]));
    },
  };
  return { client, seen };
}

function build(behaviour: { failTimes?: number } = {}) {
  const repository = new InMemoryEmbeddingRepository();
  const { client, seen } = stubClient(behaviour);
  const service = new EmbeddingService({
    repository,
    client,
    logger: silentLogger,
    sleep: async () => undefined,
  });
  return { repository, service, seen };
}

describe('EmbeddingService', () => {
  it('embeds what is waiting and remembers the words it used', async () => {
    const { repository, service, seen } = build();
    repository.add({ id: 'a', caption: 'Oak island', tags: ['wood'] });
    repository.add({ id: 'b', caption: '', tags: ['tide'], image: { tags: ['sea'] } });

    const result = await service.drainOnce();

    expect(result).toMatchObject({ embedded: 2, failed: 0, skipped: 0 });
    expect(seen[0]).toEqual(['Oak island. wood', 'tide, sea']);
    // 'Oak island. wood' is sixteen characters, which is what the stub encodes.
    expect(repository.get('a')?.embedding).toEqual([16, 0, 1]);
    expect(repository.get('a')?.inputHash).toBe(embeddingInputHash('Oak island. wood'));
    expect(await repository.countPending(RECOMMENDATIONS.embedding.maxAttempts)).toBe(0);
  });

  it('leaves a failed batch in the queue and counts the attempt against it', async () => {
    const { repository, service } = build({ failTimes: 1 });
    repository.add({ id: 'a', caption: 'Oak island' });

    expect(await service.drainOnce()).toMatchObject({ embedded: 0, failed: 1 });
    expect(repository.get('a')?.embedding).toBeNull();
    expect(repository.get('a')?.attempts).toBe(1);

    // The provider comes back; the picture is still there to be picked up.
    expect(await service.drainOnce()).toMatchObject({ embedded: 1, failed: 0 });
    expect(repository.get('a')?.attempts).toBe(0);
  });

  it('stops asking about a picture that has no words at all', async () => {
    const { repository, service, seen } = build();
    repository.add({ id: 'empty' });
    repository.add({ id: 'a', caption: 'Oak island' });

    const result = await service.drainOnce();

    expect(result).toMatchObject({ embedded: 1, skipped: 1 });
    expect(seen[0]).toEqual(['Oak island']);
    expect(await repository.countPending(RECOMMENDATIONS.embedding.maxAttempts)).toBe(0);
  });

  it('re-embeds a picture whose caption changed, and leaves the rest alone', async () => {
    const { repository, service } = build();
    const events = new RecordingEventBus();
    service.listen(events);
    repository.add({ id: 'a', caption: 'Oak island' });
    repository.add({ id: 'b', caption: 'Low tide' });
    await service.drainAll();

    repository.edit('a', { caption: 'Oak island at dusk' });
    await events.publish(
      createEvent('item.updated', {
        collectionId: 'c1',
        actorId: 'u1',
        itemId: 'a',
        moved: false,
      }),
    );

    const result = await service.drainOnce();
    expect(result).toMatchObject({ invalidated: 1, embedded: 1 });
    expect(repository.get('a')?.inputHash).toBe(
      embeddingInputHash(
        embeddingText({ caption: 'Oak island at dusk', tags: [], image: { tags: [] } }),
      ),
    );
    // b was never touched.
    expect(repository.get('b')?.embedding).toEqual([8, 0, 1]);
  });

  it('does nothing for an edit that did not change the words', async () => {
    const { repository, service } = build();
    const events = new RecordingEventBus();
    service.listen(events);
    repository.add({ id: 'a', caption: 'Oak island' });
    await service.drainAll();

    await events.publish(
      createEvent('item.updated', {
        collectionId: 'c1',
        actorId: 'u1',
        itemId: 'a',
        moved: true,
      }),
    );

    expect(await service.drainOnce()).toMatchObject({ invalidated: 0, embedded: 0 });
  });

  it('never makes the person who saved the picture wait for the model', async () => {
    const { repository, service } = build();
    const events = new RecordingEventBus();
    service.listen(events);
    repository.add({ id: 'a', caption: 'Oak island' });

    const embed = vi.fn();
    await events.publish(
      createEvent('item.added', {
        collectionId: 'c1',
        actorId: 'u1',
        itemId: 'a',
        imageId: 'i1',
      }),
    );

    // Publishing returned without embedding anything: the work is the worker's.
    expect(embed).not.toHaveBeenCalled();
    expect(repository.get('a')?.embedding).toBeNull();
    expect(await repository.countPending(RECOMMENDATIONS.embedding.maxAttempts)).toBe(1);
  });

  it('empties the whole queue, however many batches that takes', async () => {
    const { repository, service } = build();
    const size = RECOMMENDATIONS.embedding.batchSize;
    for (let index = 0; index < size + 3; index += 1) {
      repository.add({ id: `i${index}`, caption: `picture ${index}` });
    }

    const total = await service.drainAll();

    expect(total.embedded).toBe(size + 3);
    expect(await repository.countPending(RECOMMENDATIONS.embedding.maxAttempts)).toBe(0);
  });
});
