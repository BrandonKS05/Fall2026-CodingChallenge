import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, searchResultFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import ExplorePage from './ExplorePage';

const SEARCH_BOX = 'Search images, boards and people';

/** A board as Explore sees it: public, with covers to make an album of. */
const publicBoard = (id: string, title: string, previews = 3, itemCount = 8) =>
  boardFixture({
    id,
    title,
    visibility: 'public',
    role: null,
    itemCount,
    previewImageIds: Array.from({ length: previews }, (_, index) => `${id}-img${index + 1}`),
  });

const feed = [
  publicBoard('c1', 'Warm kitchens'),
  publicBoard('c2', 'Fog and pines'),
  publicBoard('c3', 'Tide pools', 1, 3),
  publicBoard('c4', 'Neon after rain'),
  publicBoard('c5', 'Ceramics'),
];

const user = {
  id: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-09-14T12:00:00Z',
};

/** More boards than a visitor is shown, so the gate has something to hide. */
const longFeed = Array.from({ length: 12 }, (_, index) =>
  publicBoard(`c${index + 1}`, `Board ${index + 1}`),
);

function renderExplore(
  route: StubRoute = { body: { collections: feed } },
  session: StubRoute = { body: { user: null } },
) {
  const api = stubApi({
    'GET /api/auth/me': session,
    'GET /api/explore': route,
    'GET /api/search': { body: { results: [], page: 1, perPage: 30, total: 0 } },
    'GET /api/search/categories': { body: { covers: [] } },
    'GET /api/collections': { body: { collections: [] } },
    'GET /api/users/search': { body: { profiles: [] } },
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<ExplorePage />, { route: '/explore' });
  return api;
}

describe('ExplorePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lays every public board out as an album: a big cover and two beside it', async () => {
    renderExplore();
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();

    const wall = await screen.findByRole('list', { name: 'Public boards' });
    const links = within(wall).getAllByRole('button', { name: /^Open / });
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveTextContent('Warm kitchens');
    expect(links[0]).toHaveTextContent('8 images · Ada');

    // Three pictures make the sleeve; a board with one gives it the whole frame.
    expect(within(links[0] as HTMLElement).getAllByRole('presentation')).toHaveLength(3);
    const lonely = links.find((link) => link.textContent?.includes('Tide pools'));
    expect(within(lonely as HTMLElement).getAllByRole('presentation')).toHaveLength(1);
  });

  it('searches the library when there is a query, and browses boards when there is not', async () => {
    const api = renderExplore();
    await screen.findAllByRole('button', { name: /^Open / });

    await userEvent.type(screen.getByLabelText(SEARCH_BOX), 'tide pools');

    await waitFor(() => expect(api.calls.some((call) => call.path === '/api/search')).toBe(true));
    // The album wall steps aside while results are on screen.
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Public boards' })).toBeNull());
    // So does the category grid: it is a way in, not a thing to read past results.
    expect(screen.queryByRole('region', { name: 'Browse by category' })).toBeNull();
  });

  it('answers a search with people and boards as well as images', async () => {
    const api = stubApi({
      'GET /api/auth/me': { body: { user: null } },
      'GET /api/explore': { body: { collections: feed } },
      'GET /api/search': {
        body: {
          results: [{ ...searchResultFixture('s1', { tags: ['kitchen'] }) }],
          page: 1,
          perPage: 30,
          total: 1,
        },
      },
      'GET /api/collections': { body: { collections: [] } },
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
    expect(within(boards).getAllByRole('button', { name: /^Open / })[0]).toHaveTextContent(
      'Warm kitchens',
    );
    expect(await screen.findByAltText('Kitchen')).toBeInTheDocument();
  });

  it('searches people alone when the words start with an @', async () => {
    const api = stubApi({
      'GET /api/auth/me': { body: { user: null } },
      'GET /api/explore': { body: { collections: feed } },
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

  it('shows visitors two sharp rows and blurs the rest behind a sign-in prompt', async () => {
    renderExplore({ body: { collections: longFeed } });
    const links = await screen.findAllByRole('button', { name: /^Open / });
    expect(links).toHaveLength(8);
    expect(screen.getByText('Sign in to see the rest.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows members everything with no prompt', async () => {
    renderExplore({ body: { collections: longFeed } }, { body: { user } });
    const links = await screen.findAllByRole('button', { name: /^Open / });
    expect(links).toHaveLength(12);
    expect(screen.queryByText(/Sign in to see the rest/)).not.toBeInTheDocument();
  });

  it('keeps the site chrome in the landing position and says so when nothing is public', async () => {
    renderExplore({ body: { collections: [] } });
    expect(await screen.findByText(/Nothing public yet/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Boards' })).toHaveAttribute('href', '/boards');
    expect(within(nav).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
