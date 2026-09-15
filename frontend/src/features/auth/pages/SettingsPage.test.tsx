import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_USER_PREFERENCES } from '@wumboo/shared';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import SettingsPage from './SettingsPage';

const user = { ...userFixture, bio: 'Old bio', preferences: DEFAULT_USER_PREFERENCES };

function renderSettings(route = '/settings', routes: Record<string, StubRoute> = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user } },
    'GET /api/auth/providers': { body: { google: true } },
    'PATCH /api/auth/me': ({ body }) => ({ body: { ...user, ...(body as object) } }),
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/:section" element={<SettingsPage />} />
      <Route path="/" element={<h1>Landing</h1>} />
    </Routes>,
    { route },
  );
  return api;
}

const patched = (api: ReturnType<typeof stubApi>) =>
  api.calls.filter((call) => call.method === 'PATCH').at(-1)?.body;

describe('SettingsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens on Account and moves between sections from the list', async () => {
    renderSettings();
    expect(await screen.findByRole('heading', { name: 'Account', level: 2 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Notifications' }));
    expect(
      await screen.findByRole('heading', { name: 'Notifications', level: 2 }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Security' }));
    expect(await screen.findByLabelText('Current password')).toBeInTheDocument();
  });

  it('saves the profile, keeping the handle rule in view', async () => {
    const api = renderSettings();
    const bio = await screen.findByLabelText('Bio');
    await userEvent.clear(bio);
    await userEvent.type(bio, 'Collector of quiet kitchens.');
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(patched(api)).toMatchObject({
        displayName: 'Ada',
        handle: 'ada',
        bio: 'Collector of quiet kitchens.',
      }),
    );
    expect(
      screen.getByText('How people find you. Once you change it, it stays put for two weeks.'),
    ).toBeInTheDocument();
  });

  it('sends one switch at a time, leaving the others alone', async () => {
    const api = renderSettings('/settings/notifications');
    const toggle = await screen.findByLabelText('Someone likes a board of yours');
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(patched(api)).toEqual({ preferences: { notifications: { collectionLiked: false } } }),
    );
  });

  it('mutes and unmutes a tag', async () => {
    const api = renderSettings('/settings/content', {
      'PATCH /api/auth/me': ({ body }) => {
        const patch = body as { preferences: { mutedTags: string[] } };
        return { body: { ...user, preferences: { ...user.preferences, ...patch.preferences } } };
      },
    });
    await userEvent.type(await screen.findByLabelText('Muted tags'), 'Neon');
    await userEvent.click(screen.getByRole('button', { name: 'Mute' }));

    await waitFor(() => expect(patched(api)).toEqual({ preferences: { mutedTags: ['neon'] } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Unmute neon' }));
    await waitFor(() => expect(patched(api)).toEqual({ preferences: { mutedTags: [] } }));
  });

  it('turns discovery off from Privacy', async () => {
    const api = renderSettings('/settings/privacy');
    await userEvent.click(await screen.findByLabelText('Turn up in Explore'));
    await waitFor(() => expect(patched(api)).toEqual({ preferences: { discoverable: false } }));
  });

  it('deletes the account only after confirming, then leaves for the landing page', async () => {
    const api = renderSettings('/settings/account-management', {
      'DELETE /api/auth/me': { status: 204 },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog');
    expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete for good' }));

    await waitFor(() => expect(api.calls.some((call) => call.method === 'DELETE')).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Landing' })).toBeInTheDocument();
  });
});
