import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardFixture, itemFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import SharedBoardPage from './SharedBoardPage';

function renderShared(routes: Record<string, StubRoute>) {
  vi.stubGlobal('fetch', stubApi(routes).fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/s/:slug" element={<SharedBoardPage />} />
    </Routes>,
    { route: '/s/abc' },
  );
}

describe('SharedBoardPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a shared board read-only for visitors', async () => {
    const board = boardFixture({
      visibility: 'unlisted',
      shareSlug: 'abc',
      role: null,
      itemCount: 1,
    });
    renderShared({
      'GET /api/shared/abc': { body: { collection: board, items: [itemFixture()] } },
    });

    expect(await screen.findByRole('heading', { name: 'Kitchen ideas' })).toBeInTheDocument();
    expect(screen.getByText('Shared board')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remove item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in your boards' })).not.toBeInTheDocument();
  });

  it('offers members the full board and explains dead links', async () => {
    const board = boardFixture({ visibility: 'unlisted', shareSlug: 'abc', role: 'editor' });
    renderShared({ 'GET /api/shared/abc': { body: { collection: board, items: [] } } });
    expect(await screen.findByRole('link', { name: 'Open in your boards' })).toHaveAttribute(
      'href',
      `/boards/${board.id}`,
    );
    vi.unstubAllGlobals();

    renderShared({
      'GET /api/shared/abc': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Shared board not found' } },
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'This link is no longer valid' }),
    ).toBeInTheDocument();
  });
});
