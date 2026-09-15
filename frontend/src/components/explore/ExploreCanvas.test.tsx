import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { ExploreCanvas } from './ExploreCanvas';

const boards = [
  boardFixture({
    id: 'c1',
    title: 'Warm kitchens',
    visibility: 'public',
    previewImageIds: ['i1', 'i2', 'i3'],
  }),
  boardFixture({ id: 'c2', title: 'Fog and pines', visibility: 'public', previewImageIds: ['i4'] }),
];

function renderCanvas(route: StubRoute = { body: { collections: boards } }, props = {}) {
  const api = stubApi({ 'GET /api/explore': route });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<ExploreCanvas {...props} />);
  return api;
}

function stubMediaQueries(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.some((m) => query.includes(m)),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('ExploreCanvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('scatters every board cover first, then their other images, each linking to its board', async () => {
    const api = renderCanvas();
    const tiles = await screen.findAllByRole('link', { name: /^Open / });
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Open Warm kitchens',
      'Open Fog and pines',
      'Open Warm kitchens',
      'Open Warm kitchens',
    ]);
    expect(tiles[0]).toHaveAttribute('href', '/boards/c1');
    expect(tiles[1]).toHaveAttribute('href', '/boards/c2');
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', '/api/images/i1');
    expect(api.calls[0]?.url).toContain('perPage=12');
  });

  it('renders the chrome and the custom cursor, and swaps Sign in for Discover when signed in', async () => {
    renderCanvas();
    expect(screen.getByRole('link', { name: /see more work/i })).toHaveAttribute(
      'href',
      '/explore',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Boards' })).toBeInTheDocument();
    expect(screen.getByTestId('cursor-dot')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Featured boards' })).toHaveClass('cursor-none');
    vi.unstubAllGlobals();

    renderCanvas({ body: { collections: [] } }, { signedIn: true });
    expect(await screen.findByRole('link', { name: 'Discover' })).toHaveAttribute(
      'href',
      '/discover',
    );
  });

  it('drops a tile whose image fails to load instead of showing a broken picture', async () => {
    renderCanvas();
    const images = await screen.findAllByRole('img');
    expect(images).toHaveLength(4);

    fireEvent.error(images[0] as HTMLImageElement);

    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(3));
    expect(screen.getByRole('link', { name: 'Open Fog and pines' })).toBeInTheDocument();
  });

  it('fails silently to an empty stage', async () => {
    renderCanvas({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'down' } } });
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: /see more work/i })).toBeInTheDocument();
  });

  it('falls back to a static scatter with the native cursor for reduced motion and touch', async () => {
    stubMediaQueries(['prefers-reduced-motion']);
    renderCanvas();
    await screen.findAllByRole('img');
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Featured boards' })).not.toHaveClass('cursor-none');
    vi.unstubAllGlobals();

    stubMediaQueries(['pointer: coarse']);
    renderCanvas();
    await screen.findAllByRole('img');
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument();
  });
});
