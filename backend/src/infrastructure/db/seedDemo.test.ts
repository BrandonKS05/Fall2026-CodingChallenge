import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, type Container } from '../../container.js';
import type { ProviderImage } from '../../domain/entities/ProviderImage.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import {
  FakePasswordHasher,
  FakeTokenService,
  silentLogger,
} from '../../testing/fakes/fakeAuth.js';
import { createFakeFetch, FAKE_JPEG } from '../../testing/fakes/fakeFetch.js';
import { FakeImageProvider, fakeProviderImage } from '../../testing/fakes/FakeImageProvider.js';
import { InMemoryStorage } from '../../testing/fakes/InMemoryStorage.js';
import { buildTestEnv, noDatabase } from '../../testing/testApp.js';
import { DEMO_ACCOUNT, SEED_BOARDS, seedDemo, type BoardSeed } from './seedDemo.js';

/** Provider hits for one seed board; the tag carries the exact query because the fake search matches on tags. */
function hitsFor(board: BoardSeed, count = board.count): ProviderImage[] {
  const slug = board.title.toLowerCase().replace(/\s+/g, '-');
  return Array.from({ length: count }, (_, index) =>
    fakeProviderImage(`${slug}-${index + 1}`, { tags: [board.query, 'seed'] }),
  );
}

const TOTAL_IMAGES = SEED_BOARDS.reduce((sum, board) => sum + board.count, 0);

interface Harness {
  container: Container;
  repositories: ReturnType<typeof createFakeRepositories>;
  storage: InMemoryStorage;
  /** The provider's live catalog; push into it to simulate the provider having more to offer later. */
  catalog: ProviderImage[];
}

function buildHarness(catalog: ProviderImage[]): Harness {
  const repositories = createFakeRepositories();
  const storage = new InMemoryStorage();
  const container = createContainer(buildTestEnv(), {
    database: noDatabase,
    repositories,
    storage,
    imageProvider: new FakeImageProvider(catalog),
    fetchFn: createFakeFetch({ '*': { contentType: 'image/jpeg', body: FAKE_JPEG } }),
    passwordHasher: new FakePasswordHasher(),
    tokens: new FakeTokenService(),
    healthIndicators: [],
  });
  return { container, repositories, storage, catalog };
}

async function boardsOf(harness: Harness, email: string) {
  const user = await harness.repositories.users.findByEmail(email);
  if (!user) throw new Error(`No account ${email}`);
  return harness.repositories.collections.listForUser(user.id);
}

async function itemCount(harness: Harness, title: string): Promise<number> {
  const board = (await boardsOf(harness, DEMO_ACCOUNT.email)).find((b) => b.title === title);
  if (!board) throw new Error(`No board ${title}`);
  return (await harness.repositories.items.listByCollection(board.id)).length;
}

describe('seedDemo', () => {
  let harness: Harness;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    harness = buildHarness(SEED_BOARDS.flatMap((board) => hitsFor(board)));
    void silentLogger;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await harness.container.dispose();
  });

  it('creates both accounts, every board with its images, the share link, and the shared membership', async () => {
    await seedDemo(harness.container);

    const demoBoards = await boardsOf(harness, DEMO_ACCOUNT.email);
    expect(demoBoards.map((b) => b.title).sort()).toEqual(SEED_BOARDS.map((b) => b.title).sort());
    for (const seed of SEED_BOARDS) {
      expect(await itemCount(harness, seed.title)).toBe(seed.count);
    }
    expect(demoBoards.find((b) => b.title === 'Fog and pines')?.shareSlug).toBeTruthy();
    expect(demoBoards.find((b) => b.title === 'Tide pools')?.role).toBe('editor');
    expect(harness.storage.objects.size).toBe(TOTAL_IMAGES);
  });

  it('seeds enough public images for the landing stage', async () => {
    const publicCount = SEED_BOARDS.filter((b) => b.visibility === 'public').reduce(
      (sum, b) => sum + b.count,
      0,
    );
    expect(publicCount).toBeGreaterThanOrEqual(24);

    await seedDemo(harness.container);

    const feed = await harness.repositories.collections.listPublicImages({ limit: 24 });
    expect(feed).toHaveLength(24);
    expect(new Set(feed.map((row) => row.collectionId)).size).toBeGreaterThanOrEqual(4);
    const publicTitles = SEED_BOARDS.filter((b) => b.visibility === 'public').map((b) => b.title);
    const lead = feed.slice(0, publicTitles.length).map((row) => row.collectionTitle);
    expect(new Set(lead).size).toBe(publicTitles.length);
    expect(lead.sort()).toEqual([...publicTitles].sort());
  });

  it('adds nothing on a second run', async () => {
    await seedDemo(harness.container);
    const before = {
      boards: (await boardsOf(harness, DEMO_ACCOUNT.email)).map((b) => b.id).sort(),
      files: harness.storage.objects.size,
      notifications: await harness.repositories.notifications.countUnread(
        (await harness.repositories.users.findByEmail(DEMO_ACCOUNT.email))?.id ?? '',
      ),
    };

    await seedDemo(harness.container);

    expect((await boardsOf(harness, DEMO_ACCOUNT.email)).map((b) => b.id).sort()).toEqual(
      before.boards,
    );
    for (const seed of SEED_BOARDS) {
      expect(await itemCount(harness, seed.title)).toBe(seed.count);
    }
    expect(harness.storage.objects.size).toBe(before.files);
    expect(
      await harness.repositories.notifications.countUnread(
        (await harness.repositories.users.findByEmail(DEMO_ACCOUNT.email))?.id ?? '',
      ),
    ).toBe(before.notifications);
    expect(vi.mocked(console.log).mock.calls.flat()).toContain(
      '\nDemo data already present; nothing to add.',
    );
  });

  it('finishes a run that was cut short: missing boards and short boards are topped up, nothing is duplicated', async () => {
    const [kitchens, ...rest] = SEED_BOARDS;
    if (!kitchens) throw new Error('seed boards missing');
    // First run: the provider has only three kitchen photos and nothing for the other boards.
    harness = buildHarness(hitsFor(kitchens, 3));
    await seedDemo(harness.container);
    expect(await itemCount(harness, kitchens.title)).toBe(3);
    for (const seed of rest) expect(await itemCount(harness, seed.title)).toBe(0);
    const firstIds = (await boardsOf(harness, DEMO_ACCOUNT.email)).map((b) => b.id).sort();

    // The provider now has everything; the next run fills the gaps and keeps what was there.
    harness.catalog.push(...hitsFor(kitchens).slice(3), ...rest.flatMap((board) => hitsFor(board)));
    await seedDemo(harness.container);

    for (const seed of SEED_BOARDS) {
      expect(await itemCount(harness, seed.title)).toBe(seed.count);
    }
    expect((await boardsOf(harness, DEMO_ACCOUNT.email)).map((b) => b.id).sort()).toEqual(firstIds);
    expect(harness.storage.objects.size).toBe(TOTAL_IMAGES);
  });
});
