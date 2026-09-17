import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { renderWithProviders, stubApi } from '@/testing/render';

const user = {
  id: '1',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: new Date().toISOString(),
};

/** A page that can summon the card, and reports where it is. */
function Page() {
  const auth = useAuthDialog();
  const location = useLocation();
  return (
    <main>
      <h1>Discover page</h1>
      <p data-testid="path">{location.pathname}</p>
      <button onClick={() => auth.open({ mode: 'login' })}>Open login</button>
    </main>
  );
}

function renderPage(routes: Parameters<typeof stubApi>[0] = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: null } },
    'GET /api/auth/handle-available': ({ url }) => ({
      body: { handle: new URL(url, 'http://x').searchParams.get('handle'), available: true },
    }),
    'GET /api/auth/providers': { body: { google: false } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<Page />, { route: '/explore' });
  return api;
}

describe('AuthDialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('floats the card over the page, blurs the page, and switches to sign-up in place', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Open login' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    // The page behind a modal is inert to role queries, but it is still there.
    expect(screen.getByText('Discover page')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('backdrop-blur-xs');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create an account' }));
    expect(within(dialog).getByRole('heading', { name: 'Start your gallery' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/explore');
  });

  it('signs up, closes, and stays on the page', async () => {
    const api = renderPage({ 'POST /api/auth/register': { body: { user } } });
    await userEvent.click(screen.getByRole('button', { name: 'Open login' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create an account' }));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ada');
    await userEvent.type(within(dialog).getByLabelText('Email'), 'ada@example.com');
    await userEvent.clear(within(dialog).getByLabelText('Handle'));
    await userEvent.type(within(dialog).getByLabelText('Handle'), 'ada');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'lovelace-1815');
    await userEvent.type(within(dialog).getByLabelText('Confirm password'), 'lovelace-1815');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign up' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('path')).toHaveTextContent('/explore');
    expect(api.calls.find((call) => call.method === 'POST')).toMatchObject({
      path: '/api/auth/register',
      body: { email: 'ada@example.com', handle: 'ada', displayName: 'Ada' },
    });
  });

  it('closes with Escape without leaving the page', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Open login' }));
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('path')).toHaveTextContent('/explore');
  });
});
