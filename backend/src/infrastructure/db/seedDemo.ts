/**
 * Seeds a demo account with filled boards so a fresh checkout shows a real,
 * populated app. Run with `pnpm db:seed`, or set SEED_DEMO=true so the server
 * seeds on boot (handy on hosts with no shell).
 *
 * Idempotent and resumable: every step checks before it creates, so a boot
 * flag left on costs a few queries, and a run that was cut short (a redeploy
 * mid-seed, a provider outage) finishes on the next one instead of leaving
 * half the boards missing for good.
 *
 * Everything goes through the same services the API uses, so images are
 * downloaded and stored exactly as a user's saves would be, and the demo
 * inbox holds real notifications from the shared board.
 */

import type { Container } from '../../container.js';
import type { CollectionVisibility } from '../../domain/entities/Collection.js';

export const DEMO_ACCOUNT = {
  email: 'demo@wumboo.app',
  password: 'demo-password-123',
  displayName: 'Demo User',
};
const FRIEND_ACCOUNT = {
  email: 'sam@wumboo.app',
  password: 'demo-password-123',
  displayName: 'Sam Rivera',
};

export interface BoardSeed {
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

export const SEED_BOARDS: BoardSeed[] = [
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

interface Account {
  id: string;
  email: string;
}

export async function seedDemo(container: Container): Promise<void> {
  const { services, repositories, logger } = container;
  const log = logger.child({ script: 'seed' });

  const demo = await ensureAccount(container, DEMO_ACCOUNT);
  const sam = await ensureAccount(container, FRIEND_ACCOUNT);
  const accounts = { demo, sam };
  let boardsCreated = 0;
  let imagesSaved = 0;
  let imagesSkipped = false;

  for (const seedBoard of SEED_BOARDS) {
    const owner = accounts[seedBoard.owner];
    const other = seedBoard.owner === 'demo' ? sam : demo;

    const existing = (await repositories.collections.listForUser(owner.id)).find(
      (candidate) => candidate.ownerId === owner.id && candidate.title === seedBoard.title,
    );
    const board =
      existing ??
      (await services.collections.create(owner.id, {
        title: seedBoard.title,
        description: seedBoard.description,
        visibility: seedBoard.visibility,
      }));
    if (!existing) boardsCreated += 1;

    if (seedBoard.shareWithOther && !(await repositories.memberships.find(board.id, other.id))) {
      await services.share.invite(board.id, owner.id, other.email, 'editor');
    }
    // Returns the existing slug when the board already has one.
    if (seedBoard.shareLink) await services.share.createLink(board.id, owner.id);

    const items = await repositories.items.listByCollection(board.id);
    const missing = seedBoard.count - items.length;
    if (missing <= 0) continue;

    try {
      const { results } = await services.images.search({
        q: seedBoard.query,
        page: 1,
        perPage: seedBoard.count,
        orientation: 'all',
      });
      const present = new Set(items.map((item) => item.image.providerImageId));
      let added = 0;
      for (const [index, hit] of results.entries()) {
        if (added >= missing) break;
        if (present.has(hit.providerImageId)) continue;
        // On the shared board, both people contribute, so each side gets notifications.
        const actor = seedBoard.shareWithOther && index % 2 === 1 ? other : owner;
        await services.items.add(board.id, actor.id, {
          provider: hit.provider,
          providerImageId: hit.providerImageId,
          caption: '',
          tags: hit.tags.slice(0, 3),
        });
        added += 1;
      }
      imagesSaved += added;
      console.log(`  ${seedBoard.title}: ${items.length + added}/${seedBoard.count} images`);
    } catch (error) {
      imagesSkipped = true;
      log.warn({ err: error, board: seedBoard.title }, 'Could not fetch images; board left short');
      console.log(
        `  ${seedBoard.title}: ${items.length}/${seedBoard.count} images (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }

  console.log(
    boardsCreated === 0 && imagesSaved === 0
      ? '\nDemo data already present; nothing to add.'
      : `\nSeeded ${boardsCreated} boards and ${imagesSaved} images.`,
  );
  if (imagesSkipped) {
    console.log(
      'Some boards are short of images. Check PIXABAY_API_KEY, then run the seed again; it only adds what is missing.',
    );
  }
  console.log(
    `Log in with ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password} (or ${FRIEND_ACCOUNT.email} with the same password).`,
  );
}

async function ensureAccount(container: Container, account: typeof DEMO_ACCOUNT): Promise<Account> {
  const existing = await container.repositories.users.findByEmail(account.email);
  if (existing) return existing;
  return (await container.services.auth.register(account)).user;
}
