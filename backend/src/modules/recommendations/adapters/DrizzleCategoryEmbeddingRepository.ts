import type { SearchCategory } from '@wumboo/shared';
import { inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../infrastructure/db/client.js';
import { categoryEmbeddings } from '../../../infrastructure/db/schema/index.js';
import type {
  CategoryEmbedding,
  CategoryEmbeddingRepository,
} from '../ports/CategoryEmbeddingRepository.js';

export class DrizzleCategoryEmbeddingRepository implements CategoryEmbeddingRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<CategoryEmbedding[]> {
    const rows = await this.db
      .select({
        category: categoryEmbeddings.category,
        embedding: categoryEmbeddings.embedding,
        sourceText: categoryEmbeddings.sourceText,
      })
      .from(categoryEmbeddings);
    return rows;
  }

  async findByCategories(categories: SearchCategory[]): Promise<CategoryEmbedding[]> {
    if (categories.length === 0) return [];
    return this.db
      .select({
        category: categoryEmbeddings.category,
        embedding: categoryEmbeddings.embedding,
        sourceText: categoryEmbeddings.sourceText,
      })
      .from(categoryEmbeddings)
      .where(inArray(categoryEmbeddings.category, categories));
  }

  async upsert(entries: CategoryEmbedding[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db
      .insert(categoryEmbeddings)
      .values(entries)
      .onConflictDoUpdate({
        target: categoryEmbeddings.category,
        set: {
          embedding: sql`excluded.embedding`,
          sourceText: sql`excluded.source_text`,
          updatedAt: sql`now()`,
        },
      });
  }
}
