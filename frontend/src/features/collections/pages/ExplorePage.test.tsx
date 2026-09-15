import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, exploreImageFixture, searchResultFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import ExplorePage from './ExplorePage';

const kitchens = { id: 'c1', title: 'Warm kitchens' };
const pines = { id: 'c2', title: 'Fog and pines' };
const feed = [
  exploreImageFixture('i1', kitchens, { width: 1600, height: 1200 }),
  exploreImageFixture('i2', pines, { width: 900, height: 1600 }),
  exploreImageFixture('i3', kitchens, { width: 2000, height: 1000 }),
  exploreImageFixture('i4', pines),
  exploreImageFixture('i5', kitchens),
];

const SEARCH_BOX = 'Search images, boards and people';

const user = {
  id: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-09-14T12:00:00Z',
};

/** A feed long enough to trip the visitor gate, alternating boards. */
const longFeed = Array.from({ length: 20 }, (_, index) =>
  exploreImageFixture(`i${index + 1}`, index % 2 ? pines : kitchens),
);

function renderExplore(
  route: StubRoute = { body: { images: feed } },
  session: StubRoute = { body: { user: null } },
) {
  const api = stubApi({
    'GET /api/auth/me': session,
    'GET /api/explore/images': route,
    'GET /api/search': { body: { results: [], page: 1, perPage: 30, total: 0 } },
    'GET /api/collections': { body: { collections: [] } },
    'GET /api/explore': { body: { collections: [] } },
    'GET /api/users/search': { body: { profiles: [] } },
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<ExplorePage />, { route: '/explore' });
  return api;
}

describe('ExplorePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lays every public image out in justified rows, each linking to its board', async () => {
    const api = renderExplore();
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();

    const links = await screen.findAllByRole('link', { name: /^Open / });
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute('href', '/boards/c1');
    expect(links[1]).toHaveAttribute('href', '/boards/c2');
    // A wide image grows more than a tall one, so rows fill edge to edge.
    const wide = links[2]?.parentElement as HTMLElement;
    const tall = links[1]?.parentElement as HTMLElement;
    expect(Number(wide.style.flexGrow)).toBeGreaterThan(Number(tall.style.flexGrow));
    expect(api.calls.find((call) => call.path === '/api/explore/images')?.url).toContain(
      'limit=60',
    );
  });

  it('searches the library when there is a query, and browses boards when there is not', async () => {
    const api = renderExplore();
    await screen.findAllByRole('link', { name: /^Open / });

    await userEvent.type(screen.getByLabelText(SEARCH_BOX), 'tide pools');

    await waitFor(() => expect(api.calls.some((call) => call.path === '/api/search')).toBe(true));
    // The board gallery steps aside while results are on screen.
    await waitFor(() => expect(screen.queryByRole('link', { name: /^Open / })).toBeNull());
    // So does the category grid: it is a way in, not a thing to read past results.
    expect(screen.queryByRole('region', { name: 'Browse by category' })).toBeNull();
  });

  it('answers a search with people and boards as well as images', async () => {
    const api = stubApi({
      'GET /api/auth/me': { body: { user: null } },
      'GET /api/explore/images': { body: { images: feed } },
      'GET /api/search': {
        body: {
          results: [{ ...searchResultFixture('s1', { tags: ['kitchen'] }) }],
          page: 1,
          perPage: 30,
          total: 1,
        },
      },
      'GET /api/collections': { body: { collections: [] } },
      'GET /api/explore': { body: { collections: [boardFixture({ title: 'Warm kitchens' })] } },
      'GET /api/users/search': {
        body: {
          profiles: [
            {
              id: 'u9',
              handle: 'ada',
              displayName: 'Ada L',
              bio: '',
              followedByViewer: false,
            },
          ],
        },
      },
    });
    vi.stubGlobal('fetch', api.fetchMock);
    renderWithProviders(<ExplorePage />, { route: '/explore?q=kitchen' });

    expect(await screen.findByRole('region', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ada L/ })).toHaveAttribute('href', '/u/ada');
    const boards = await screen.findByRole('region', { name: 'Boards' });
    expect(within(boards).getByRole('link', { name: 'Open Warm kitchens' })).toBeInTheDocument();
    expect(await screen.findByAltText('Kitchen')).toBeInTheDocument();
  });

  it('searches people alone when the words start with an @', async () => {
    const api = stubApi({
      'GET /api/auth/me': { body: { user: null } },
      'GET /api/explore/images': { body: { images: feed } },
      'GET /api/explore': { body: { collections: [] } },
      'GET /api/users/search': { body: { profiles: [] } },
    });
    vi.stubGlobal('fetch', api.fetchMock);
    renderWithProviders(<ExplorePage />, { route: '/explore?q=%40ada' });

    // The @ picks the scope and is not part of the words that go to the server.
    await waitFor(() =>
      expect(api.calls.find((call) => call.path === '/api/users/search')?.url).toContain('q=ada'),
    );
    expect(api.calls.some((call) => call.path === '/api/search')).toBe(false);
    expect(api.calls.some((call) => call.path === '/api/explore')).toBe(false);
    expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Images' })).toBeNull();
  });

  it('lists every category to browse under the gallery', async () => {
    renderExplore();
    const grid = await screen.findByRole('region', { name: 'Browse by category' });
    const links = within(grid).getAllByRole('link');
    expect(links).toHaveLength(20);
    expect(links[0]).toHaveAttribute('href', '/c/animals');
  });

  it('shows visitors fifteen sharp images and blurs the rest behind a sign-in prompt', async () => {
    renderExplore({ body: { images: longFeed } });
    const links = await screen.findAllByRole('link', { name: /^Open / });
    expect(links).toHaveLength(15);
    expect(screen.getByText('15 of 20 images shown. Sign in to see the rest.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows members everything with no prompt', async () => {
    renderExplore({ body: { images: longFeed } }, { body: { user } });
    const links = await screen.findAllByRole('link', { name: /^Open / });
    expect(links).toHaveLength(20);
    expect(screen.queryByText(/Sign in to see the rest/)).not.toBeInTheDocument();
  });

  it('keeps the site chrome in the landing position and says so when nothing is public', async () => {
    renderExplore({ body: { images: [] } });
    expect(await screen.findByText(/Nothing public yet/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/boards');
    expect(within(nav).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
