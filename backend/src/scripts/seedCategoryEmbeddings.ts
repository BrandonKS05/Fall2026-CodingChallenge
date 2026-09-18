/**
 * CLI: `pnpm --filter backend embeddings:categories`.
 *
 * One vector per category on the browse grid, embedded from the written
 * description rather than the bare word. Idempotent: a category whose text has
 * not changed since it was last embedded is left alone, so this is safe to run
 * on every deploy and costs nothing when there is nothing to do.
 */
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from '../config/env.js';
import { createContainer } from '../container.js';
import { OpenAIEmbeddingClient } from '../modules/recommendations/adapters/OpenAIEmbeddingClient.js';
import { CATEGORIES, CATEGORY_TEXT } from '../modules/recommendations/categoryText.js';

process.env.LOG_LEVEL ??= 'warn';
loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);

if (!env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set: there is no model to embed the categories with.');
  process.exit(1);
}

const container = createContainer(env);
try {
  const store = container.repositories.categoryEmbeddings;
  const existing = new Map((await store.findAll()).map((row) => [row.category, row.sourceText]));
  const stale = CATEGORIES.filter((category) => existing.get(category) !== CATEGORY_TEXT[category]);

  if (stale.length === 0) {
    console.log(`All ${CATEGORIES.length} categories are already embedded.`);
  } else {
    const client = new OpenAIEmbeddingClient({
      apiKey: env.OPENAI_API_KEY,
      fetchFn: fetch,
      logger: container.logger,
    });
    const vectors = await client.embed(stale.map((category) => CATEGORY_TEXT[category]));
    await store.upsert(
      stale.map((category, index) => ({
        category,
        embedding: vectors[index] ?? [],
        sourceText: CATEGORY_TEXT[category],
      })),
    );
    console.log(`Embedded ${stale.length} categories: ${stale.join(', ')}`);
  }
} finally {
  await container.dispose();
}
