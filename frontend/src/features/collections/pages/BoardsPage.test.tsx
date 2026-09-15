import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, itemFixture, userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import BoardsPage from './BoardsPage';

const kitchens = boardFixture({
  title: 'Kitchen ideas',
  itemCount: 3,
  visibility: 'public',
  previewImageIds: ['i1', 'i2', 'i3'],
});
const outfits = boardFixture({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Fall outfits',
  role: 'editor',
  owner: { id: 'u2', displayName: 'Grace' },
});
const pins = [
  { ...itemFixture({ id: 'p1' }), collection: { id: kitchens.id, title: 'Kitchen ideas' } },
  { ...itemFixture({ id: 'p2' }), collection: { id: outfits.id, title: 'Fall outfits' } },
];

function renderBoards(routes: Record<string, StubRoute> = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: userFixture } },
    'GET /api/collections': { body: { collections: [kitchens, outfits] } },
    'GET /api/items': { body: { items: pins } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/boards" element={<BoardsPage />} />
      <Route path="/boards/:id" element={<h1>Board page</h1>} />
    </Routes>,
    { route: '/boards' },
  );
  return api;
}

describe('BoardsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the profile strip and board covers with counts, visibility, and shared-with-me notes', async () => {
    renderBoards();
    const kitchenCard = await screen.findByRole('link', { name: /open kitchen ideas/i });
    expect(kitchenCard).toHaveTextContent('3 images');
    expect(kitchenCard).toHaveTextContent('Public');
    expect(kitchenCard.querySelectorAll('img')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /open fall outfits/i })).toHaveTextContent(
      'Editor · Grace',
    );
    expect(screen.getByRole('heading', { name: 'Your finds' })).toBeInTheDocument();
    expect(await screen.findByText('2 boards · 2 images')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('always offers a Create card, which opens the creator like the Create button', async () => {
    renderBoards({ 'GET /api/collections': { body: { collections: [] } } });
    await screen.findByText('0 boards · 2 images');
    expect(screen.queryByRole('link', { name: /^Open / })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create a board' }));
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
  });

  it('lists every saved image on the Pins tab, each linking to its board', async () => {
    renderBoards();
    await userEvent.click(await screen.findByRole('tab', { name: 'Pins' }));
    const list = await screen.findByRole('list', { name: 'Your pins' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', `/boards/${kitchens.id}`);
    expect(links[1]).toHaveAccessibleName('Open Fall outfits');
    expect(screen.getByRole('tab', { name: 'Pins' })).toHaveAttribute('aria-selected', 'true');
  });

  it('creates a board from the dialog and moves to it', async () => {
    const created = boardFixture({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Brutalism',
    });
    const api = renderBoards({
      'GET /api/collections': { body: { collections: [] } },
      'POST /api/collections': { status: 201, body: created },
      'GET /api/collections/33333333-3333-4333-8333-333333333333': {
        body: { collection: created, items: [] },
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Create' }));
    await userEvent.type(await screen.findByLabelText('Title'), 'Brutalism');
    await userEvent.click(screen.getByRole('radio', { name: /public/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }));

    expect(await screen.findByText('Board page')).toBeInTheDocument();
    expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
      title: 'Brutalism',
      description: '',
      visibility: 'public',
    });
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/api/collections').length).toBeGreaterThanOrEqual(
        2,
      ),
    );
  });
});
