import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchResultFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi } from '@/testing/render';
import CategoryPage from './CategoryPage';

const results = [
  searchResultFixture('p1', { tags: ['heron', 'reeds', 'dusk'] }),
  searchResultFixture('p2', { tags: ['fox', 'snow', 'field'] }),
];

function renderCategory(name: string) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: null } },
    'GET /api/search': { body: { results, page: 1, perPage: 30, total: 2 } },
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/c/:name" element={<CategoryPage />} />
    </Routes>,
    { route: `/c/${name}` },
  );
  return api;
}

describe('CategoryPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('introduces the category and fills it with pictures, no words needed', async () => {
    const api = renderCategory('animals');

    expect(screen.getByRole('heading', { name: 'Animals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Explore' })).toHaveAttribute(
      'href',
      '/explore',
    );
    expect(await screen.findByAltText('Heron, reeds, dusk')).toBeInTheDocument();
    expect(screen.getByAltText('Fox, snow, field')).toBeInTheDocument();

    // The category is the whole query: an empty q, and this category.
    const search = api.calls.find((call) => call.path === '/api/search')?.url ?? '';
    expect(search).toContain('category=animals');
    expect(search).not.toContain('q=');
  });

  it('offers a few neighbours under the banner, leaving out the one you are on', async () => {
    renderCategory('animals');

    const nearby = await screen.findByRole('navigation', { name: 'Related categories' });
    const links = within(nearby).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/c/nature',
      '/c/places',
      '/c/people',
      '/c/travel',
    ]);
  });

  it('says so plainly when the name is not a category', () => {
    renderCategory('mopeds');

    expect(screen.getByText('No such category.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Explore' })).toHaveAttribute(
      'href',
      '/explore',
    );
  });
});
