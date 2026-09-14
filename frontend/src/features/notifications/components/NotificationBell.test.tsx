import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { NotificationBell } from './NotificationBell';

const notification = (id: string, readAt: string | null) => ({
  id,
  type: 'item_added',
  collection: { id: 'c1', title: 'Kitchens' },
  actor: { id: 'u2', displayName: 'Grace' },
  payload: {},
  readAt,
  createdAt: new Date().toISOString(),
});

function renderBell(routes: Record<string, StubRoute>) {
  const api = stubApi({ 'GET /api/auth/me': { body: { user: userFixture } }, ...routes });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/" element={<NotificationBell />} />
      <Route path="/boards/:id" element={<h1>Board page</h1>} />
    </Routes>,
  );
  return api;
}

describe('NotificationBell', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the unread count, lists activity, and clears the badge', async () => {
    let inbox = { notifications: [notification('n1', null), notification('n2', new Date().toISOString())], unreadCount: 1 };
    const api = renderBell({
      'GET /api/notifications': () => ({ body: inbox }),
      'POST /api/notifications/read': () => {
        inbox = { ...inbox, notifications: inbox.notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unreadCount: 0 };
        return { status: 204 };
      },
    });

    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    await userEvent.click(bell);
    const list = await screen.findByRole('list', { name: 'Notifications' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Grace added an image to Kitchens')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument());
    expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({});
  });

  it('opens the board behind a notification and marks it read', async () => {
    const api = renderBell({
      'GET /api/notifications': { body: { notifications: [notification('n1', null)], unreadCount: 1 } },
      'POST /api/notifications/read': { status: 204 },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await userEvent.click(await screen.findByText('Grace added an image to Kitchens'));

    expect(await screen.findByText('Board page')).toBeInTheDocument();
    await waitFor(() => expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({ ids: ['n1'] }));
  });

  it('renders nothing for visitors', async () => {
    renderBell({ 'GET /api/auth/me': { body: { user: null } } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument());
  });
});
