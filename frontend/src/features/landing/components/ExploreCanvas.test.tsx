import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { landingImageFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { ExploreCanvas } from './ExploreCanvas';
import { SLOTS, SPARE_IMAGES, TILE_LIMIT } from './slots';

/** A full curation: every slot plus the spares, in the order the server lists them. */
const FEED_SIZE = TILE_LIMIT + SPARE_IMAGES;
const spare = (n: number) => `/api/images/i${TILE_LIMIT + n}`;
const heroLeft = `${SLOTS[0]?.x ?? 0}%`;
const feed = Array.from({ length: FEED_SIZE }, (_, index) => landingImageFixture(`i${index + 1}`));

/** The stage reads public boards first; the curation is what tops it up. */
function renderCanvas(route: StubRoute = { body: { images: feed } }, props = {}) {
  const api = stubApi({
    'GET /api/explore/images': { body: { images: [] } },
    'GET /api/landing/images': route,
  });
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

// The tiles are decoration, so they have no role to query by: a test id it is.
const tileImages = () => screen.queryAllByTestId('stage-tile');
const sources = () => tileImages().map((img) => img.getAttribute('src'));
const imgBySrc = (src: string) =>
  tileImages().find((img) => img.getAttribute('src') === src) as HTMLImageElement | undefined;
/** The stage slot a tile occupies: the inline `left` of its positioned wrapper. */
const slotOf = (img: HTMLElement) => (img.closest('a')?.parentElement as HTMLElement).style.left;

describe('ExploreCanvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills every slot from the curated feed, in order, each tile leading to Explore', async () => {
    const api = renderCanvas();
    const tiles = await screen.findAllByTestId('stage-tile');
    expect(tiles).toHaveLength(TILE_LIMIT);
    expect(sources().slice(0, 3)).toEqual(['/api/images/i1', '/api/images/i2', '/api/images/i3']);

    // The curation has no board behind it, so a tile leads where the boards are,
    // and credits the photographer on the way.
    const links = screen.getAllByRole('link', { name: /^Explore — photo by / });
    expect(links).toHaveLength(TILE_LIMIT);
    expect(links[0]).toHaveAttribute('href', '/explore');
    expect(tiles[0]).toHaveAttribute('alt', 'Photo by photographer');
    expect(links[0]).toHaveTextContent('photographer');
    // The box is the slot's shape, not the picture's, so the map cannot be
    // rearranged by whatever the feed happens to contain.
    expect(links[0]).toHaveStyle({ aspectRatio: String(SLOTS[0]?.aspect) });
    // Public boards are asked for first; the curation fills what is left.
    expect(api.calls.map((call) => call.path)).toEqual([
      '/api/explore/images',
      '/api/landing/images',
    ]);
    expect(api.calls[1]?.url).toContain(`limit=${FEED_SIZE}`);
  });

  it('opens the board a picture is on, when the picture is on one', async () => {
    const api = stubApi({
      'GET /api/explore/images': {
        body: {
          images: feed.slice(0, 3).map((image, index) => ({
            image,
            collection: { id: `c${index + 1}`, title: `Board ${index + 1}` },
          })),
        },
      },
      // Not enough public images to fill the stage, so the curation tops it up.
      'GET /api/landing/images': { body: { images: feed } },
    });
    vi.stubGlobal('fetch', api.fetchMock);
    renderWithProviders(<ExploreCanvas />);

    // A picture on a board opens that board where the visitor is standing.
    expect(await screen.findByRole('button', { name: /^Board 1 — photo by / })).toBeInTheDocument();
    // The curated filler still leads to Explore, because it is on no board.
    expect(
      (await screen.findAllByRole('link', { name: /^Explore — photo by / })).length,
    ).toBeGreaterThan(0);
  });

  it('renders the chrome and the custom cursor, and drops Sign in once there is a session', async () => {
    renderCanvas();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Boards' })).toBeInTheDocument();
    expect(screen.getByTestId('cursor-dot')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Featured boards' })).toHaveClass('cursor-none');
    cleanup();
    vi.unstubAllGlobals();

    renderCanvas({ body: { images: [] } }, { signedIn: true });
    // Signed in there is no Sign in link, and no Discover: Explore holds the search now.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull());
    expect(screen.queryByRole('link', { name: 'Discover' })).toBeNull();
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
    await screen.findAllByTestId('stage-tile');
    const first = imgBySrc('/api/images/i1')!;
    const second = imgBySrc('/api/images/i2')!;
    const slot = slotOf(first);

    fireEvent.error(first);

    await waitFor(() => expect(imgBySrc(spare(1))).toBeDefined());
    expect(slotOf(imgBySrc(spare(1))!)).toBe(slot);
    expect(imgBySrc('/api/images/i1')).toBeUndefined();
    expect(imgBySrc('/api/images/i2')).toBe(second);
    expect(sources()).toHaveLength(TILE_LIMIT);
  });

  it('claims spares in failure order, including when a spare itself fails', async () => {
    renderCanvas();
    await screen.findAllByTestId('stage-tile');
    fireEvent.error(imgBySrc('/api/images/i1')!);
    await waitFor(() => expect(imgBySrc(spare(1))).toBeDefined());

    const sixth = slotOf(imgBySrc('/api/images/i6')!);
    fireEvent.error(imgBySrc('/api/images/i6')!);
    await waitFor(() => expect(imgBySrc(spare(2))).toBeDefined());
    expect(slotOf(imgBySrc(spare(2))!)).toBe(sixth);
    expect(slotOf(imgBySrc(spare(1))!)).toBe(heroLeft);

    fireEvent.error(imgBySrc(spare(1))!);
    await waitFor(() => expect(imgBySrc(spare(3))).toBeDefined());
    expect(slotOf(imgBySrc(spare(3))!)).toBe(heroLeft);
    expect(imgBySrc(spare(1))).toBeUndefined();
    expect(slotOf(imgBySrc(spare(2))!)).toBe(sixth);
    expect(sources()).toHaveLength(TILE_LIMIT);
  });

  it('hides a failed tile when no spare is left, and a short feed fills only its own slots', async () => {
    renderCanvas({ body: { images: feed.slice(0, TILE_LIMIT) } });
    await screen.findAllByTestId('stage-tile');
    fireEvent.error(imgBySrc('/api/images/i1')!);
    await waitFor(() => expect(sources()).toHaveLength(TILE_LIMIT - 1));
    expect(imgBySrc(spare(1))).toBeUndefined();
    cleanup();
    vi.unstubAllGlobals();

    renderCanvas({ body: { images: feed.slice(0, 5) } });
    await waitFor(() => expect(sources()).toHaveLength(5));
  });

  it('fails silently to an empty stage', async () => {
    renderCanvas({ status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'down' } } });
    await waitFor(() => expect(tileImages()).toHaveLength(0));
    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
  });

  it('holds the map still and gives the cursor back while something is open over it', async () => {
    const listeners = vi.spyOn(window, 'addEventListener');
    renderCanvas({ body: { images: feed } }, { paused: true });
    await screen.findAllByTestId('stage-tile');

    // Nothing is listening, so the map cannot move: it stays exactly where the
    // pointer left it rather than sliding back to rest behind the dialog.
    expect(listeners.mock.calls.some(([type]) => type === 'pointermove')).toBe(false);
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument();
    // The thing in front needs pointing at.
    expect(screen.getByRole('region', { name: 'Featured boards' })).not.toHaveClass('cursor-none');
    listeners.mockRestore();
    cleanup();
    vi.unstubAllGlobals();

    const tracking = vi.spyOn(window, 'addEventListener');
    renderCanvas();
    await screen.findAllByTestId('stage-tile');
    expect(tracking.mock.calls.some(([type]) => type === 'pointermove')).toBe(true);
    expect(screen.getByTestId('cursor-dot')).toBeInTheDocument();
    tracking.mockRestore();
  });

  it('falls back to a static scatter with the native cursor for reduced motion and touch', async () => {
    stubMediaQueries(['prefers-reduced-motion']);
    renderCanvas();
    await screen.findAllByTestId('stage-tile');
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Featured boards' })).not.toHaveClass('cursor-none');
    vi.unstubAllGlobals();

    stubMediaQueries(['pointer: coarse']);
    renderCanvas();
    await screen.findAllByTestId('stage-tile');
    expect(screen.queryByTestId('cursor-dot')).not.toBeInTheDocument();
  });
});
