import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi } from '@/testing/render';
import BoardsPage from './BoardsPage';

describe('BoardsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists boards with counts, visibility, and shared-with-me badges', async () => {
    const boards = [
      boardFixture({ title: 'Kitchen ideas', itemCount: 3, visibility: 'public' }),
      boardFixture({
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Fall outfits',
        role: 'editor',
        owner: { id: 'u2', displayName: 'Grace' },
      }),
    ];
    vi.stubGlobal(
      'fetch',
      stubApi({ 'GET /api/collections': { body: { collections: boards } } }).fetchMock,
    );
    renderWithProviders(<BoardsPage />);

    expect(await screen.findByRole('link', { name: /kitchen ideas/i })).toHaveTextContent(
      '3 images',
    );
    expect(screen.getByRole('link', { name: /kitchen ideas/i })).toHaveTextContent('Public');
    expect(screen.getByRole('link', { name: /fall outfits/i })).toHaveTextContent('Editor · Grace');
  });

  it('renders board cards as plus-only tiles in the landing-page style', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET /api/collections': {
          body: { collections: [boardFixture({ title: 'Kitchen ideas' })] },
        },
      }).fetchMock,
    );
    renderWithProviders(<BoardsPage />);

    const card = await screen.findByRole('link', { name: /open kitchen ideas/i });
    expect(card.querySelector('img')).toBeNull();
    expect(card).toHaveTextContent('+');
  });

  it('shows blank cards ready to be filled, and any of them opens the creator', async () => {
    vi.stubGlobal(
      'fetch',
      stubApi({
        'GET /api/collections': {
          body: { collections: [boardFixture({ title: 'Kitchen ideas' })] },
        },
      }).fetchMock,
    );
    renderWithProviders(<BoardsPage />);
    await screen.findByRole('link', { name: /kitchen ideas/i });

    // One real board, seven blank cards to reach a full grid, plus the header button.
    const blanks = screen.getAllByRole('button', { name: 'New board' });
    expect(blanks).toHaveLength(8);
    await userEvent.click(blanks[blanks.length - 1]!);
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
  });

  it('creates a board from the dialog and moves to it', async () => {
    const created = boardFixture({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Brutalism',
    });
    const api = stubApi({
      'GET /api/collections': { body: { collections: [] } },
      'POST /api/collections': { status: 201, body: created },
      'GET /api/collections/33333333-3333-4333-8333-333333333333': {
        body: { collection: created, items: [] },
      },
    });
    vi.stubGlobal('fetch', api.fetchMock);
    renderWithProviders(
      <Routes>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<h1>Board page</h1>} />
      </Routes>,
      { route: '/boards' },
    );

    await userEvent.click((await screen.findAllByRole('button', { name: /new board/i }))[0]!);
    await userEvent.type(await screen.findByLabelText('Title'), 'Brutalism');
    await userEvent.click(screen.getByRole('radio', { name: /public/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }));

    expect(await screen.findByText('Board page')).toBeInTheDocument();
    const post = api.calls.find((call) => call.method === 'POST');
    expect(post?.body).toEqual({ title: 'Brutalism', description: '', visibility: 'public' });
    await waitFor(() =>
      expect(api.calls.filter((c) => c.path === '/api/collections').length).toBeGreaterThanOrEqual(
        2,
      ),
    );
  });
});
