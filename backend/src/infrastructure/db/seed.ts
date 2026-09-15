/**
 * Seeds a demo account with filled boards so a fresh checkout shows a real,
 * populated app. Run with `pnpm db:seed`. Idempotent: it does nothing if the
 * demo account already exists.
 *
 * Everything goes through the same services the API uses, so images are
 * downloaded and stored exactly as a user's saves would be, and the demo
 * inbox holds real notifications from the shared board.
 */
import { loadDotEnvFile, loadEnv, loadEnvOrExit } from '../../config/env.js';
import { createContainer, type Container } from '../../container.js';
import type { CollectionVisibility } from '../../domain/entities/Collection.js';

export const DEMO_ACCOUNT = {
  email: 'demo@trove.app',
  password: 'demo-password-123',
  displayName: 'Demo User',
};
const FRIEND_ACCOUNT = {
  email: 'sam@trove.app',
  password: 'demo-password-123',
  displayName: 'Sam Rivera',
};

interface BoardSeed {
  owner: 'demo' | 'sam';
  title: string;
  description: string;
  visibility: CollectionVisibility;
  query: string;
  count: number;
  /** Creates a share link so the demo has a working /s/<slug> page. */
  shareLink?: boolean;
  /** Adds the other account as an editor, which also exercises notifications. */
  shareWithOther?: boolean;
}

const BOARDS: BoardSeed[] = [
  {
    owner: 'demo',
    title: 'Warm kitchens',
    description: 'Oak, brass, and low afternoon light.',
    visibility: 'public',
    query: 'kitchen interior wood',
    count: 8,
  },
  {
    owner: 'demo',
    title: 'Fog and pines',
    description: 'The Pacific Northwest on a slow morning.',
    visibility: 'unlisted',
    query: 'foggy forest pine',
    count: 6,
    shareLink: true,
  },
  {
    owner: 'demo',
    title: 'Brutalist libraries',
    description: 'Concrete, light, and silence.',
    visibility: 'private',
    query: 'brutalist architecture concrete',
    count: 6,
  },
  {
    owner: 'sam',
    title: 'Tide pools',
    description: "Sam's finds, shared with the demo account as an editor.",
    visibility: 'private',
    query: 'tide pool',
    count: 6,
    shareWithOther: true,
  },
];

async function seed(container: Container): Promise<void> {
  const { services, repositories, logger } = container;
  const log = logger.child({ script: 'seed' });

  if (await repositories.users.findByEmail(DEMO_ACCOUNT.email)) {
    console.log(`Already seeded. Log in with ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`);
    return;
  }

  const demo = (await services.auth.register(DEMO_ACCOUNT)).user;
  const sam = (await services.auth.register(FRIEND_ACCOUNT)).user;
  const accounts = { demo, sam };
  let imagesSaved = 0;
  let imagesSkipped = false;

  for (const seedBoard of BOARDS) {
    const owner = accounts[seedBoard.owner];
    const other = seedBoard.owner === 'demo' ? sam : demo;
    const board = await services.collections.create(owner.id, {
      title: seedBoard.title,
      description: seedBoard.description,
      visibility: seedBoard.visibility,
    });
    if (seedBoard.shareWithOther)
      await services.share.invite(board.id, owner.id, other.email, 'editor');
    if (seedBoard.shareLink) await services.share.createLink(board.id, owner.id);

    try {
      const { results } = await services.images.search({
        q: seedBoard.query,
        page: 1,
        perPage: seedBoard.count,
        orientation: 'all',
      });
      for (const [index, hit] of results.entries()) {
        // On the shared board, both people contribute, so each side gets notifications.
        const actor = seedBoard.shareWithOther && index % 2 === 1 ? other : owner;
        await services.items.add(board.id, actor.id, {
          provider: hit.provider,
          providerImageId: hit.providerImageId,
          caption: '',
          tags: hit.tags.slice(0, 3),
        });
        imagesSaved += 1;
      }
      console.log(`  ${seedBoard.title}: ${results.length} images`);
    } catch (error) {
      imagesSkipped = true;
      log.warn({ err: error, board: seedBoard.title }, 'Could not fetch images; board left empty');
      console.log(
        `  ${seedBoard.title}: created without images (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }

  console.log(`\nSeeded 2 accounts, ${BOARDS.length} boards, ${imagesSaved} images.`);
  if (imagesSkipped) {
    console.log(
      'Some boards have no images. Check PIXABAY_API_KEY in backend/.env and run the seed again after deleting the demo accounts.',
    );
  }
  console.log(
    `Log in with ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password} (or ${FRIEND_ACCOUNT.email} with the same password).`,
  );
}

// The summary lines are the output that matters; keep service logs to warnings and above.
process.env.LOG_LEVEL ??= 'warn';
loadDotEnvFile();
const env = loadEnvOrExit(loadEnv);
const container = createContainer(env);
try {
  await seed(container);
} finally {
  await container.dispose();
}
