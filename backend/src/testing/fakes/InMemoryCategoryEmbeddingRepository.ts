import type { SearchCategory } from '@wumboo/shared';
import type {
  CategoryEmbedding,
  CategoryEmbeddingRepository,
} from '../../modules/recommendations/ports/CategoryEmbeddingRepository.js';

/** Empty until a test puts something in it, which is what an unseeded install looks like. */
export class InMemoryCategoryEmbeddingRepository implements CategoryEmbeddingRepository {
  private readonly rows = new Map<SearchCategory, CategoryEmbedding>();

  findAll(): Promise<CategoryEmbedding[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  findByCategories(categories: SearchCategory[]): Promise<CategoryEmbedding[]> {
    return Promise.resolve(
      categories.map((category) => this.rows.get(category)).filter((row) => row !== undefined),
    );
  }

  upsert(entries: CategoryEmbedding[]): Promise<void> {
    for (const entry of entries) this.rows.set(entry.category, entry);
    return Promise.resolve();
  }
}
