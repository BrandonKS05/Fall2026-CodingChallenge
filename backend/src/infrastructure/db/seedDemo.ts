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
import { CATEGORY_COVER_IDS } from '../../modules/images/categoryCovers.js';
import { LANDING_IMAGE_IDS, LANDING_PROVIDER } from '../../modules/images/landingImages.js';
import {
  SEED_BOARDS,
  SEED_FOLLOWS,
  SEED_LIKES,
  SEED_PASSWORD,
  SEED_PEOPLE,
  type PersonSeed,
} from './seedPeople.js';

/** The login the README hands to a grader; the person behind it is the first seeded one. */
export const DEMO_ACCOUNT = {
  email: SEED_PEOPLE[0]?.email ?? 'demo@wumboo.app',
  password: SEED_PASSWORD,
};

interface Account {
  id: string;
  email: string;
}

export async function seedDemo(container: Container): Promise<void> {
  const { services, repositories, logger } = container;
  const log = logger.child({ script: 'seed' });

  const curated = await ensureCuratedImages(container);
  if (curated > 0) console.log(`Stored ${curated} curated images.`);

  // Everyone first, so a board can name its owner and its editor by handle.
  const people = new Map<string, Account>();
  for (const person of SEED_PEOPLE) {
    people.set(person.handle, await ensurePerson(container, person));
  }
  let boardsCreated = 0;
  let imagesSaved = 0;
  let imagesSkipped = false;

  for (const seedBoard of SEED_BOARDS) {
    const owner = people.get(seedBoard.owner);
    const editor = seedBoard.editor ? people.get(seedBoard.editor) : undefined;
    if (!owner) continue;

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

    if (editor && !(await repositories.memberships.find(board.id, editor.id))) {
      await services.share.invite(board.id, owner.id, editor.email, 'editor');
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
        // On a shared board both people contribute, so each side gets notifications.
        const actor = editor && index % 2 === 1 ? editor : owner;
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

  const followed = await seedFollows(container, people);
  const liked = await seedLikes(container, people);
  if (followed > 0 || liked > 0) {
    console.log(`Added ${followed} follows and ${liked} likes.`);
  }

  console.log(
    boardsCreated === 0 && imagesSaved === 0 && followed === 0 && liked === 0
      ? '\nDemo data already present; nothing to add.'
      : `\nSeeded ${boardsCreated} boards and ${imagesSaved} images.`,
  );
  if (imagesSkipped) {
    console.log(
      'Some boards are short of images. Check PIXABAY_API_KEY, then run the seed again; it only adds what is missing.',
    );
  }
  console.log(
    `Log in with ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}.` +
      ` Every seeded account uses that password; the others are ${SEED_PEOPLE.slice(1, 4)
        .map((person) => person.email)
        .join(', ')} and so on.`,
  );
}

/**
 * The two fixed curations — the landing stage and the category covers.
 * Downloaded like any other image, but owned by nobody: they belong to no
 * board, so nothing a person saves can change the front of the product.
 */
async function ensureCuratedImages(container: Container): Promise<number> {
  let stored = 0;
  const wanted = [...LANDING_IMAGE_IDS, ...Object.values(CATEGORY_COVER_IDS)];
  for (const providerImageId of wanted) {
    const existing = await container.repositories.images.findByProviderId(
      LANDING_PROVIDER,
      providerImageId,
    );
    if (existing) continue;
    try {
      await container.services.images.ensureStored(LANDING_PROVIDER, providerImageId);
      stored += 1;
    } catch (error) {
      container.logger.warn({ err: error, providerImageId }, 'Landing image unavailable');
    }
  }
  return stored;
}

/**
 * Seeded accounts skip the code: there is nobody to read the mailbox, and an
 * account nobody can sign into is no demo at all. An account that already
 * exists has its name, handle and bio brought up to date, so a database seeded
 * before these people had names does not keep the old ones.
 */
async function ensurePerson(container: Container, person: PersonSeed): Promise<Account> {
  const { users } = container.repositories;
  const existing = await users.findByEmail(person.email);
  if (existing) {
    const stale =
      existing.displayName !== person.displayName ||
      existing.bio !== person.bio ||
      (existing.handle !== person.handle && (await users.findByHandle(person.handle)) === null);
    if (!stale) return existing;
    return users.update(existing.id, {
      displayName: person.displayName,
      bio: person.bio,
      ...(existing.handle === person.handle ? {} : { handle: person.handle }),
    });
  }
  const created = await users.create({
    email: person.email,
    handle: person.handle,
    displayName: person.displayName,
    passwordHash: await container.passwordHasher.hash(SEED_PASSWORD),
    emailVerifiedAt: new Date(),
  });
  // A bio is something a person writes, so it arrives the way one would: as an edit.
  return users.update(created.id, { bio: person.bio });
}

/** The follow graph, added once; following twice is not an error, only a no-op. */
async function seedFollows(container: Container, people: Map<string, Account>): Promise<number> {
  let added = 0;
  for (const [follower, followee] of SEED_FOLLOWS) {
    const from = people.get(follower);
    const to = people.get(followee);
    if (!from || !to) continue;
    if (await container.repositories.follows.follow(from.id, to.id)) added += 1;
  }
  return added;
}

/** A few likes, so no board shows a bare zero. */
async function seedLikes(container: Container, people: Map<string, Account>): Promise<number> {
  let added = 0;
  for (const [handle, title] of SEED_LIKES) {
    const liker = people.get(handle);
    const board = (
      await container.repositories.collections.listPublic({ limit: 200, offset: 0 })
    ).find((candidate) => candidate.title === title);
    if (!liker || !board || board.likedByViewer) continue;
    if (await container.repositories.likes.like(board.id, liker.id)) added += 1;
  }
  return added;
}
