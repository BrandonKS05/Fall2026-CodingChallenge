import type {
  EmbeddableRow,
  EmbeddingRepository,
  SavedEmbedding,
} from '../../modules/recommendations/ports/EmbeddingRepository.js';

interface Stored extends EmbeddableRow {
  embedding: number[] | null;
  attempts: number;
  /** Position in the queue; the real one orders by when the picture was saved. */
  savedAt: number;
}

/** The embedding queue as a Map, with the same ordering and attempt rules. */
export class InMemoryEmbeddingRepository implements EmbeddingRepository {
  private readonly rows = new Map<string, Stored>();
  private next = 0;

  add(row: Partial<EmbeddableRow> & { id: string }): void {
    this.rows.set(row.id, {
      id: row.id,
      caption: row.caption ?? '',
      tags: row.tags ?? [],
      image: row.image ?? { tags: [] },
      inputHash: row.inputHash ?? null,
      embedding: null,
      attempts: 0,
      savedAt: this.next++,
    });
  }

  get(id: string): Stored | undefined {
    return this.rows.get(id);
  }

  /** Rewrites a picture's words, the way editing a caption would. */
  edit(id: string, changes: Partial<Pick<EmbeddableRow, 'caption' | 'tags'>>): void {
    const row = this.rows.get(id);
    if (row) Object.assign(row, changes);
  }

  claimPending(limit: number, maxAttempts: number): Promise<EmbeddableRow[]> {
    const pending = [...this.rows.values()]
      .filter((row) => row.embedding === null && row.attempts < maxAttempts)
      .sort((a, b) => a.savedAt - b.savedAt)
      .slice(0, limit);
    return Promise.resolve(pending.map(strip));
  }

  findByIds(ids: string[]): Promise<EmbeddableRow[]> {
    const found = ids.map((id) => this.rows.get(id)).filter((row) => row !== undefined);
    return Promise.resolve(found.map(strip));
  }

  save(entries: SavedEmbedding[]): Promise<void> {
    for (const entry of entries) {
      const row = this.rows.get(entry.id);
      if (!row) continue;
      row.embedding = entry.embedding;
      row.inputHash = entry.inputHash;
      row.attempts = 0;
    }
    return Promise.resolve();
  }

  recordFailure(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) row.attempts += 1;
    }
    return Promise.resolve();
  }

  skip(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) row.attempts = Number.MAX_SAFE_INTEGER;
    }
    return Promise.resolve();
  }

  clearEmbedding(ids: string[]): Promise<void> {
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) {
        row.embedding = null;
        row.attempts = 0;
      }
    }
    return Promise.resolve();
  }

  countPending(maxAttempts: number): Promise<number> {
    return Promise.resolve(
      [...this.rows.values()].filter((row) => row.embedding === null && row.attempts < maxAttempts)
        .length,
    );
  }
}

function strip(row: Stored): EmbeddableRow {
  return {
    id: row.id,
    caption: row.caption,
    tags: row.tags,
    image: row.image,
    inputHash: row.inputHash,
  };
}
