import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import SettingsPage from './SettingsPage';

function renderSettings(routes: Record<string, StubRoute> = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: { ...userFixture, bio: 'Old bio' } } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/" element={<h1>Landing</h1>} />
    </Routes>,
    { route: '/settings' },
  );
  return api;
}

describe('SettingsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves a new name and bio', async () => {
    const api = renderSettings({
      'PATCH /api/auth/me': ({ body }) => ({
        body: { ...userFixture, ...(body as object) },
      }),
    });
    const bio = await screen.findByLabelText('Bio');
    expect(bio).toHaveValue('Old bio');
    await userEvent.clear(bio);
    await userEvent.type(bio, 'Collector of quiet kitchens.');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === 'PATCH')).toMatchObject({
        path: '/api/auth/me',
        body: { displayName: 'Ada', bio: 'Collector of quiet kitchens.' },
      }),
    );
    expect(screen.getByText('28/160')).toBeInTheDocument();
  });

  it('deletes the account only after confirming, then leaves for the landing page', async () => {
    const api = renderSettings({ 'DELETE /api/auth/me': { status: 204 } });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete for good' }));

    await waitFor(() => expect(api.calls.some((call) => call.method === 'DELETE')).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument();
  });
});
