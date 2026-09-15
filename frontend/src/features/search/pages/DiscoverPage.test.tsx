import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, searchResultFixture, userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import DiscoverPage from './DiscoverPage';

const results = ['1', '2', '3'].map((id) => searchResultFixture(id));
const board = boardFixture({ role: 'owner' });

function renderDiscover(routes: Record<string, StubRoute>, route = '/') {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: userFixture } },
    'GET /api/collections': { body: { collections: [board] } },
    'GET /api/search': { body: { results, page: 1, perPage: 30, total: 3 } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<DiscoverPage />, { route });
  return api;
}

describe('DiscoverPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches after a pause in typing and credits Pixabay', async () => {
    const api = renderDiscover({});
    expect(screen.getByRole('heading', { name: 'Find it again.' })).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search images' }), 'kitchen');
    expect(await screen.findAllByRole('img', { name: /kitchen, oak/ })).toHaveLength(3);

    const searchCall = api.calls.find((call) => call.path === '/api/search');
    expect(searchCall?.url).toContain('q=kitchen');
    expect(searchCall?.url).toContain('perPage=30');
    expect(screen.getByRole('link', { name: 'Pixabay' })).toHaveAttribute(
      'href',
      'https://pixabay.com/',
    );
    expect(screen.queryByRole('heading', { name: 'Find it again.' })).not.toBeInTheDocument();
  });

  it('saves through the board picker and marks the card', async () => {
    const api = renderDiscover(
      { [`POST /api/collections/${board.id}/items`]: { status: 201, body: {} } },
      '/?q=kitchen',
    );

    const cards = await screen.findAllByRole('figure');
    await userEvent.click(within(cards[0]!).getByRole('button', { name: /^Save/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /kitchen ideas/i }));

    await waitFor(() =>
      expect(
        within(cards[0]!).getByRole('button', { name: 'Saved to Kitchen ideas' }),
      ).toBeInTheDocument(),
    );
    const post = api.calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({
      provider: 'pixabay',
      providerImageId: '1',
      caption: '',
      tags: [],
    });
  });

  it('creates a board from the picker when the user has none', async () => {
    const created = boardFixture({ id: '22222222-2222-4222-8222-222222222222', title: 'Fresh' });
    const api = renderDiscover(
      {
        'GET /api/collections': { body: { collections: [] } },
        'POST /api/collections': { status: 201, body: created },
        [`POST /api/collections/${created.id}/items`]: { status: 201, body: {} },
      },
      '/?q=kitchen',
    );
    const cards = await screen.findAllByRole('figure');
    await userEvent.click(within(cards[1]!).getByRole('button', { name: /^Save/ }));
    await userEvent.type(await screen.findByLabelText('New board title'), 'Fresh');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(within(cards[1]!).getByRole('button', { name: 'Saved to Fresh' })).toBeInTheDocument(),
    );
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toContain(
      'POST /api/collections',
    );
  });

  it('saves with one click when arriving from a board, and treats duplicates as saved', async () => {
    const api = renderDiscover(
      {
        [`POST /api/collections/${board.id}/items`]: {
          status: 409,
          body: { error: { code: 'CONFLICT', message: 'already there' } },
        },
      },
      `/?q=kitchen&board=${board.id}`,
    );
    expect(await screen.findByText(/saving straight into/i)).toHaveTextContent('Kitchen ideas');
    const cards = await screen.findAllByRole('figure');
    await userEvent.click(within(cards[2]!).getByRole('button', { name: /^Save/ }));

    await waitFor(() =>
      expect(
        within(cards[2]!).getByRole('button', { name: 'Saved to Kitchen ideas' }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'POST')).toBe(true);
  });

  it('asks visitors to log in instead of saving', async () => {
    const api = renderDiscover({ 'GET /api/auth/me': { body: { user: null } } }, '/?q=kitchen');
    const cards = await screen.findAllByRole('figure');
    await userEvent.click(within(cards[0]!).getByRole('button', { name: /^Save/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    // A visitor's boards are never requested: that endpoint needs a session and would only 401.
    expect(api.calls.some((call) => call.path === '/api/collections')).toBe(false);
  });
});
