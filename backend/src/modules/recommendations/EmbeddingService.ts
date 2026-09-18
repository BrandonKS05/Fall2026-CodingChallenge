/**
 * Gives every saved picture a vector, without ever making somebody wait for it.
 *
 * The queue is the table — a picture wants a vector exactly while its embedding
 * column is null — so the only thing an item event has to do is wake the worker
 * and return. Nothing is held in memory that a restart could lose, and a batch
 * interrupted halfway is simply claimed again.
 */
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import { RECOMMENDATIONS } from '../../config/recommendations.js';
import { embeddingInputHash, embeddingText } from './embeddingText.js';
import type { EmbeddingClient } from './ports/EmbeddingClient.js';
import type {
  EmbeddableRow,
  EmbeddingRepository,
  SavedEmbedding,
} from './ports/EmbeddingRepository.js';

const { batchSize, maxAttempts, idlePollMs } = RECOMMENDATIONS.embedding;

export interface EmbeddingServiceDeps {
  repository: EmbeddingRepository;
  client: EmbeddingClient;
  logger: Logger;
  /**
   * Called with the pictures that have just been given a vector for the first
   * time. Somebody may already have saved one of them, and that act could not
   * teach the profile anything until now.
   */
  onFirstEmbedded?: (itemIds: string[]) => Promise<void>;
  /** Injected in tests so an idle loop does not really wait. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DrainResult {
  embedded: number;
  failed: number;
  /** Pictures with nothing to embed: no caption, no tags, not even the photographer's. */
  skipped: number;
  /** Pictures whose words changed and whose vector was thrown away. */
  invalidated: number;
}

export class EmbeddingService {
  /** Pictures whose text may have changed since it was embedded. */
  private readonly changed = new Set<string>();
  private wake: (() => void) | null = null;
  private stopped = false;

  constructor(private readonly deps: EmbeddingServiceDeps) {}

  /**
   * Listens for boards gaining and losing pictures. The handlers do no work of
   * their own: whoever added the picture is waiting on that request.
   */
  listen(events: EventBus): () => void {
    const unsubscribes = [
      events.subscribe('item.added', () => {
        this.nudge();
      }),
      events.subscribe('item.updated', (event) => {
        this.changed.add(event.payload.itemId);
        this.nudge();
      }),
    ];
    return () => unsubscribes.forEach((off) => off());
  }

  /** One pass: re-queue what changed, then embed one batch of whatever is waiting. */
  async drainOnce(): Promise<DrainResult> {
    const invalidated = await this.requeueChanged();
    const pending = await this.deps.repository.claimPending(batchSize, maxAttempts);
    if (pending.length === 0) return { embedded: 0, failed: 0, skipped: 0, invalidated };

    const texts = new Map(pending.map((row) => [row.id, embeddingText(row)]));
    // A picture nobody described and that arrived with no tags has nothing to
    // embed. Retrying it would fail the same way for ever.
    const empty = pending.filter((row) => texts.get(row.id) === '');
    const work = pending.filter((row) => texts.get(row.id) !== '');
    await this.deps.repository.skip(empty.map((row) => row.id));

    if (work.length === 0) {
      return { embedded: 0, failed: 0, skipped: empty.length, invalidated };
    }

    try {
      const vectors = await this.deps.client.embed(work.map((row) => texts.get(row.id) ?? ''));
      const saved: SavedEmbedding[] = work.map((row, index) => ({
        id: row.id,
        embedding: vectors[index] ?? [],
        inputHash: embeddingInputHash(texts.get(row.id) ?? ''),
      }));
      await this.deps.repository.save(saved);
      // First time only: a re-embed after an edit must not count the same
      // save twice.
      const firstTime = work.filter((row) => row.inputHash === null).map((row) => row.id);
      if (firstTime.length > 0) await this.deps.onFirstEmbedded?.(firstTime);
      return { embedded: saved.length, failed: 0, skipped: empty.length, invalidated };
    } catch (error) {
      // The batch keeps its place in the queue; only its attempt count moves.
      await this.deps.repository.recordFailure(work.map((row) => row.id));
      this.deps.logger.error(
        { size: work.length, error: error instanceof Error ? error.message : String(error) },
        'An embedding batch failed',
      );
      return { embedded: 0, failed: work.length, skipped: empty.length, invalidated };
    }
  }

  /**
   * Empties the queue and stops. This is what the backfill runs; the worker
   * calls it too, so a cold start catches up before it settles into polling.
   */
  async drainAll(onProgress?: (result: DrainResult) => void): Promise<DrainResult> {
    const total: DrainResult = { embedded: 0, failed: 0, skipped: 0, invalidated: 0 };
    for (;;) {
      const result = await this.drainOnce();
      total.embedded += result.embedded;
      total.failed += result.failed;
      total.skipped += result.skipped;
      total.invalidated += result.invalidated;
      onProgress?.(result);
      // A failed batch keeps its place, so stopping on failure is what keeps
      // this from spinning against a provider that is down.
      if (result.embedded === 0) return total;
    }
  }

  /** Runs until stopped: drains what is waiting, then sleeps until woken or the poll comes round. */
  async run(): Promise<void> {
    this.stopped = false;
    while (!this.stopped) {
      try {
        await this.drainAll();
      } catch (error) {
        this.deps.logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'The embedding worker stumbled',
        );
      }
      if (!this.stopped) await this.idle();
    }
  }

  stop(): void {
    this.stopped = true;
    this.wake?.();
  }

  private nudge(): void {
    this.wake?.();
  }

  /** Sleeps until something arrives or the poll interval passes, whichever is first. */
  private async idle(): Promise<void> {
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.wake = null;
        resolve();
      };
      this.wake = finish;
      void sleep(idlePollMs).then(finish);
    });
  }

  /**
   * A caption or a tag that changed makes the vector a description of
   * something that is no longer there, so the vector goes and the picture
   * rejoins the queue.
   */
  private async requeueChanged(): Promise<number> {
    if (this.changed.size === 0) return 0;
    const ids = [...this.changed];
    this.changed.clear();

    const rows = await this.deps.repository.findByIds(ids);
    const stale = rows.filter(
      (row: EmbeddableRow) =>
        row.inputHash !== null && row.inputHash !== embeddingInputHash(embeddingText(row)),
    );
    await this.deps.repository.clearEmbedding(stale.map((row) => row.id));
    return stale.length;
  }
}
