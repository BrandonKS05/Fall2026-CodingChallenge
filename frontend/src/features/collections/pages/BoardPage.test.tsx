import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, itemFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi } from '@/testing/render';
import BoardPage from './BoardPage';

const board = boardFixture({ itemCount: 2 });
const items = [
  itemFixture({ caption: 'Oak island' }),
  itemFixture({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', caption: 'Black taps', position: 1 }),
];
const detailPath = `/api/collections/${board.id}`;

function renderBoard(routes: Parameters<typeof stubApi>[0]) {
  const api = stubApi({
    'GET /api/auth/me': {
      body: {
        user: {
          id: 'u1',
          email: 'ada@example.com',
          displayName: 'Ada',
          bio: '',
          createdAt: board.createdAt,
        },
      },
    },
    'GET /api/collections': { body: { collections: [board] } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/boards/:id" element={<BoardPage />} />
    </Routes>,
    { route: `/boards/${board.id}` },
  );
  return api;
}

describe('BoardPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the board and its images with owner controls', async () => {
    renderBoard({ [`GET ${detailPath}`]: { body: { collection: board, items } } });

    expect(await screen.findByRole('heading', { name: 'Kitchen ideas' })).toBeInTheDocument();
    expect(screen.getByText('2 images')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove item' })).toHaveLength(2);
  });

  it('likes a board you do not own, optimistically, and settles on the server count', async () => {
    const theirs = { ...board, role: null, likeCount: 2, likedByViewer: false };
    const api = renderBoard({
      [`GET ${detailPath}`]: { body: { collection: theirs, items } },
      [`POST ${detailPath}/like`]: {
        body: { ...theirs, likeCount: 3, likedByViewer: true },
      },
    });
    const like = await screen.findByRole('button', { name: 'Like this board' });
    expect(like).toHaveTextContent('2');

    await userEvent.click(like);

    const unlike = await screen.findByRole('button', { name: 'Unlike this board' });
    expect(unlike).toHaveTextContent('3');
    expect(unlike).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(api.calls.some((call) => call.method === 'POST')).toBe(true));
  });

  it('removes an image optimistically and the refetch agrees', async () => {
    let remaining = [...items];
    const api = renderBoard({
      [`GET ${detailPath}`]: () => ({
        body: { collection: { ...board, itemCount: remaining.length }, items: remaining },
      }),
      [`DELETE ${detailPath}/items/${items[0]!.id}`]: () => {
        remaining = remaining.filter((item) => item.id !== items[0]!.id);
        return { status: 204 };
      },
    });
    const figures = await screen.findAllByRole('figure');
    await userEvent.click(within(figures[0]!).getByRole('button', { name: 'Remove item' }));

    await waitFor(() =>
      expect(
        api.calls.some((call) => call.method === 'DELETE' && call.path.endsWith(items[0]!.id)),
      ).toBe(true),
    );
    await waitFor(() => expect(screen.getAllByRole('figure')).toHaveLength(1));
    expect(screen.getByText('Black taps')).toBeInTheDocument();
  });

  it('explains private boards to visitors and hides controls on read-only boards', async () => {
    renderBoard({
      [`GET ${detailPath}`]: {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: 'This board is private' } },
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'This board is private' }),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();

    renderBoard({
      [`GET ${detailPath}`]: { body: { collection: { ...board, role: 'viewer' }, items } },
    });
    expect(await screen.findAllByRole('heading', { name: 'Kitchen ideas' })).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Remove item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
