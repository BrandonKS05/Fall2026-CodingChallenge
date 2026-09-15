import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, stubApi } from '@/testing/render';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers login and signup to visitors', async () => {
    vi.stubGlobal('fetch', stubApi({ 'GET /api/auth/me': { body: { user: null } } }).fetchMock);
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows the account menu to signed-in users', async () => {
    const user = {
      id: '1',
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
      createdAt: new Date().toISOString(),
    };
    vi.stubGlobal('fetch', stubApi({ 'GET /api/auth/me': { body: { user } } }).fetchMock);
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );

    const trigger = await screen.findByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveTextContent('AL');
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(await screen.findByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });
});
