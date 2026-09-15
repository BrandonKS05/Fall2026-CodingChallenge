import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exploreImageFixture } from '@/testing/fixtures';
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
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<ExplorePage />, { route: '/explore' });
  return api;
}

const shownLinks = () =>
  within(screen.getByRole('list', { name: 'Public images' })).getAllByRole('link');

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
    expect(screen.getByText('5 images · 2 boards')).toBeInTheDocument();
    expect(api.calls.find((call) => call.path === '/api/explore/images')?.url).toContain(
      'limit=60',
    );
  });

  it('filters by board and flips the order from the docked menus', async () => {
    renderExplore();
    await screen.findAllByRole('link', { name: /^Open / });

    await userEvent.click(screen.getByRole('button', { name: 'Board: All boards' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Fog and pines/ }));
    expect(shownLinks()).toHaveLength(2);
    expect(shownLinks().every((link) => link.getAttribute('href') === '/boards/c2')).toBe(true);
    expect(screen.getByText('2 images · 2 boards')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Order: Newest first' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Oldest first' }));
    expect(shownLinks()[0]?.querySelector('img')).toHaveAttribute('src', '/api/images/i4');
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
