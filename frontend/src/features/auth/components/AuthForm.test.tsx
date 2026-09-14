import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, stubApi } from '@/testing/render';
import { AuthForm } from './AuthForm';

const user = { id: '1', email: 'ada@example.com', displayName: 'Ada', createdAt: new Date().toISOString() };

function renderLogin(routes: Parameters<typeof stubApi>[0]) {
  const api = stubApi(routes);
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/boards" element={<h1>Boards page</h1>} />
    </Routes>,
    { route: '/login' },
  );
  return api;
}

describe('AuthForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('validates with the shared schema before calling the API', async () => {
    const api = renderLogin({});
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(api.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('logs in, normalizes the email, and moves on to the boards page', async () => {
    const api = renderLogin({ 'POST /api/auth/login': { body: { user } } });
    await userEvent.type(screen.getByLabelText('Email'), '  Ada@Example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'lovelace-1815');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Boards page')).toBeInTheDocument();
    expect(api.calls.find((call) => call.method === 'POST')).toMatchObject({ path: '/api/auth/login', body: { email: 'ada@example.com' } });
  });

  it('shows the server message for bad credentials', async () => {
    renderLogin({
      'POST /api/auth/login': { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } } },
    });
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
  });
});

describe('AuthForm with Google', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the Google button when the server has it configured', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET /api/auth/providers': { body: { google: true } } }).fetchMock);
    renderWithProviders(<AuthForm mode="login" />);
    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', '/api/auth/google');
  });

  it('hides the Google button when it is not configured', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET /api/auth/providers': { body: { google: false } } }).fetchMock);
    renderWithProviders(<AuthForm mode="register" />);
    await screen.findByRole('button', { name: 'Sign up' });
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument();
  });

  it('explains why a Google sign-in came back', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET /api/auth/providers': { body: { google: true } } }).fetchMock);
    renderWithProviders(<AuthForm mode="login" />, { route: '/login?error=google_denied' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in was cancelled.');
  });
});
