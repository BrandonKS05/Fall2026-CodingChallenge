import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exploreImageFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { ExploreCanvas } from './ExploreCanvas';

const boards = [
  { id: 'c1', title: 'Warm kitchens' },
  { id: 'c2', title: 'Fog and pines' },
  { id: 'c3', title: 'Ceramics' },
];

/** Twenty-four rows interleaved across three boards, in the order the API returns them. */
const feed = Array.from({ length: 24 }, (_, index) =>
  exploreImageFixture(`i${index + 1}`, boards[index % boards.length] as (typeof boards)[number]),
);

function renderCanvas(route: StubRoute = { body: { images: feed } }, props = {}) {
  const api = stubApi({ 'GET /api/explore/images': route });
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

const sources = () => screen.getAllByRole('img').map((img) => img.getAttribute('src'));
const imgBySrc = (src: string) =>
  screen.getAllByRole('img').find((img) => img.getAttribute('src') === src) as
    HTMLImageElement | undefined;
/** The stage slot a tile occupies: the inline `left` of its positioned wrapper. */
const slotOf = (img: HTMLElement) => (img.closest('a')?.parentElement as HTMLElement).style.left;

describe('ExploreCanvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills eighteen slots from the feed in server order, each tile linking to its board', async () => {
    const api = renderCanvas();
    const tiles = await screen.findAllByRole('link', { name: /^Open / });
    expect(tiles).toHaveLength(18);
    expect(tiles.slice(0, 3).map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Open Warm kitchens',
      'Open Fog and pines',
      'Open Ceramics',
    ]);
    expect(tiles[0]).toHaveAttribute('href', '/boards/c1');
    expect(tiles[1]).toHaveAttribute('href', '/boards/c2');
    expect(tiles[0]).toHaveStyle({ aspectRatio: '1600 / 1200' });
    expect(sources()[0]).toBe('/api/images/i1');
    expect(api.calls[0]?.url).toContain('limit=24');
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

    renderCanvas({ body: { images: [] } }, { signedIn: true });
    expect(await screen.findByRole('link', { name: 'Discover' })).toHaveAttribute(
      'href',
      '/discover',
    );
  });

  it('keeps the stage on one paint layer: no fixed or blended layers over the moving tiles', () => {
    renderCanvas();
    expect(screen.getByRole('region', { name: 'Featured boards' })).toHaveClass('isolate');
    const dot = screen.getByTestId('cursor-dot');
    expect(dot).toHaveClass('absolute');
    expect(dot).not.toHaveClass('fixed');
    expect(screen.getByTestId('stage-noise')).not.toHaveClass('mix-blend-overlay');
  });

  it('hands the slot of a failed image to the first spare, leaving the other tiles alone', async () => {
    renderCanvas();
    await screen.findAllByRole('img');
    const first = imgBySrc('/api/images/i1')!;
    const second = imgBySrc('/api/images/i2')!;
    const slot = slotOf(first);

    fireEvent.error(first);

    await waitFor(() => expect(imgBySrc('/api/images/i19')).toBeDefined());
    expect(slotOf(imgBySrc('/api/images/i19')!)).toBe(slot);
    expect(imgBySrc('/api/images/i1')).toBeUndefined();
    expect(imgBySrc('/api/images/i2')).toBe(second);
    expect(sources()).toHaveLength(18);
  });

  it('claims spares in failure order, including when a spare itself fails', async () => {
    renderCanvas();
    await screen.findAllByRole('img');
    fireEvent.error(imgBySrc('/api/images/i1')!);
    await waitFor(() => expect(imgBySrc('/api/images/i19')).toBeDefined());

    const sixth = slotOf(imgBySrc('/api/images/i6')!);
    fireEvent.error(imgBySrc('/api/images/i6')!);
    await waitFor(() => expect(imgBySrc('/api/images/i20')).toBeDefined());
    expect(slotOf(imgBySrc('/api/images/i20')!)).toBe(sixth);
    expect(slotOf(imgBySrc('/api/images/i19')!)).toBe('40%');

    fireEvent.error(imgBySrc('/api/images/i19')!);
    await waitFor(() => expect(imgBySrc('/api/images/i21')).toBeDefined());
    expect(slotOf(imgBySrc('/api/images/i21')!)).toBe('40%');
    expect(imgBySrc('/api/images/i19')).toBeUndefined();
    expect(slotOf(imgBySrc('/api/images/i20')!)).toBe(sixth);
    expect(sources()).toHaveLength(18);
  });

  it('hides a failed tile when no spare is left, and a short feed fills only its own slots', async () => {
    renderCanvas({ body: { images: feed.slice(0, 18) } });
    await screen.findAllByRole('img');
    fireEvent.error(imgBySrc('/api/images/i1')!);
    await waitFor(() => expect(sources()).toHaveLength(17));
    expect(imgBySrc('/api/images/i19')).toBeUndefined();
    cleanup();
    vi.unstubAllGlobals();

    renderCanvas({ body: { images: feed.slice(0, 5) } });
    await waitFor(() => expect(sources()).toHaveLength(5));
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
