import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigate, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, stubApi } from '@/testing/render';
import { AuthRoute } from './AuthRoute';

const user = {
  id: '1',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: new Date().toISOString(),
};

function renderRoutes(route: string, routes: Parameters<typeof stubApi>[0] = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: null } },
    'GET /api/auth/providers': { body: { google: true } },
    'GET /api/explore': { body: { collections: [] } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      {/* Stands in for the route guard, which sends visitors here with where they came from. */}
      <Route path="/" element={<Navigate to="/login" replace state={{ from: '/boards' }} />} />
      <Route path="/login" element={<AuthRoute mode="login" />} />
      <Route path="/register" element={<AuthRoute mode="register" />} />
      <Route path="/explore" element={<h1>Explore route</h1>} />
      <Route path="/boards" element={<h1>Boards page</h1>} />
    </Routes>,
    { route },
  );
  return api;
}

describe('AuthRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens the card over Explore and explains a Google error from the query string', async () => {
    renderRoutes('/login?error=google_denied');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Google sign-in was cancelled.',
    );
    expect(await screen.findByText(/browse the public boards/)).toBeInTheDocument();
  });

  it('lands on Explore when the card is dismissed', async () => {
    renderRoutes('/register');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Start your gallery' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(await screen.findByRole('heading', { name: 'Explore route' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('returns to the page the route guard came from after logging in', async () => {
    renderRoutes('/', { 'POST /api/auth/login': { body: { user } } });
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'lovelace-1815');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Boards page' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
