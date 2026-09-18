import type { SearchCategory } from '@wumboo/shared';

export interface CategoryEmbedding {
  category: SearchCategory;
  embedding: number[];
  sourceText: string;
}

export interface CategoryEmbeddingRepository {
  findAll(): Promise<CategoryEmbedding[]>;
  findByCategories(categories: SearchCategory[]): Promise<CategoryEmbedding[]>;
  /** Writes or replaces, keyed by category. Re-seeding is safe to run twice. */
  upsert(entries: CategoryEmbedding[]): Promise<void>;
}
