/**
 * CLI: `pnpm --filter backend embeddings:backfill`.
 *
 * Walks every saved picture that has no vector yet and gives it one, a batch
 * at a time, reporting as it goes. The queue lives in the database, so this is
 * resumable: interrupt it and run it again and it carries on where it stopped.
 * The running server does the same work on its own; this is for getting an
 * existing database caught up without waiting for the poll.
 */
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from '../config/env.js';
import { createContainer } from '../container.js';
import { RECOMMENDATIONS } from '../config/recommendations.js';

process.env.LOG_LEVEL ??= 'warn';
loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);

if (!env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set: there is no model to embed the pictures with.');
  process.exit(1);
}

const container = createContainer(env);
const service = container.services.embeddings;
try {
  const { maxAttempts } = RECOMMENDATIONS.embedding;
  const waiting = await container.repositories.embeddings.countPending(maxAttempts);
  console.log(`${waiting} picture${waiting === 1 ? '' : 's'} waiting for a vector.`);

  if (service && waiting > 0) {
    let done = 0;
    const total = await service.drainAll((result) => {
      done += result.embedded;
      if (result.embedded > 0) console.log(`  ${done}/${waiting}`);
    });
    console.log(
      `Embedded ${total.embedded}, skipped ${total.skipped} with nothing to embed, ${total.failed} failed.`,
    );
    const left = await container.repositories.embeddings.countPending(maxAttempts);
    if (left > 0) console.log(`${left} still waiting; run it again once the provider is well.`);
  }
} finally {
  await container.dispose();
}
