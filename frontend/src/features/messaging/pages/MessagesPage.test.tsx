import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import MessagesPage from './MessagesPage';

const sam = { id: 'u2', handle: 'sam', displayName: 'Sam Rivera' };
const conversation = {
  id: 'c1',
  participants: [sam],
  state: 'accepted' as const,
  canSend: true,
  lastMessage: {
    body: 'Found a board for you',
    senderId: sam.id,
    createdAt: '2026-09-15T10:00:00Z',
  },
  lastMessageAt: '2026-09-15T10:00:00Z',
  unreadCount: 2,
};
const message = (id: string, body: string, sender = sam) => ({
  id,
  conversationId: 'c1',
  body,
  sender,
  createdAt: '2026-09-15T10:00:00Z',
});

function renderMessages(route = '/messages', routes: Record<string, StubRoute> = {}) {
  const api = stubApi({
    'GET /api/auth/me': { body: { user: userFixture } },
    'GET /api/conversations': ({ url }) =>
      url.includes('box=requests')
        ? { body: { conversations: [], unreadTotal: 0, requestCount: 0 } }
        : { body: { conversations: [conversation], unreadTotal: 2, requestCount: 0 } },
    'GET /api/users/ada/following': { body: { profiles: [sam] } },
    'GET /api/conversations/c1/messages': {
      body: { messages: [message('m1', 'Found a board for you')], hasMore: false },
    },
    'POST /api/conversations/c1/read': { status: 204 },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(
    <Routes>
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:id" element={<MessagesPage />} />
    </Routes>,
    { route },
  );
  return api;
}

describe('MessagesPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists conversations with who they are with, the last line, and the unread count', async () => {
    renderMessages();
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Sam Rivera')).toBeInTheDocument();
    expect(within(list).getByText('Found a board for you')).toBeInTheDocument();
    expect(within(list).getByText('2')).toBeInTheDocument();
    expect(
      screen.getByText('Pick a conversation, or start one with the pencil.'),
    ).toBeInTheDocument();
  });

  it('opens a conversation, marks it read, and shows the history', async () => {
    const api = renderMessages('/messages/c1');

    expect(await screen.findByText('Found a board for you')).toBeInTheDocument();
    expect(screen.getByText('@sam')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.calls.some((call) => call.path === '/api/conversations/c1/read')).toBe(true),
    );
  });

  it('sends a message and puts it straight in the thread', async () => {
    const api = renderMessages('/messages/c1', {
      'POST /api/conversations/c1/messages': ({ body }) => ({
        status: 201,
        body: message('m2', (body as { text: string }).text, {
          id: userFixture.id,
          handle: userFixture.handle,
          displayName: userFixture.displayName,
        }),
      }),
    });

    await userEvent.type(await screen.findByLabelText('Message Sam Rivera'), 'On my way  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('On my way')).toBeInTheDocument();
    expect(
      api.calls.find((call) => call.method === 'POST' && call.path.endsWith('/messages')),
    ).toMatchObject({ body: { text: 'On my way' } });
  });

  it('starts a conversation from the people you follow, and opens it', async () => {
    const api = renderMessages('/messages', {
      'POST /api/conversations': { status: 201, body: conversation },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'New message' }));
    const list = await screen.findByRole('list', { name: 'People you follow' });
    await userEvent.click(within(list).getByRole('button', { name: /Sam Rivera/ }));

    await waitFor(() =>
      expect(
        api.calls.find((call) => call.method === 'POST' && call.path === '/api/conversations'),
      ).toMatchObject({ body: { handle: 'sam' } }),
    );
    // Opening it is the point: the composer for that person is on screen.
    expect(await screen.findByLabelText('Message Sam Rivera')).toBeInTheDocument();
  });

  it('says across the whole conversation that it is waiting to be accepted', async () => {
    const sent = { ...conversation, canSend: false };
    renderMessages('/messages/c1', {
      'GET /api/conversations': ({ url }) =>
        url.includes('box=requests')
          ? { body: { conversations: [], unreadTotal: 0, requestCount: 0 } }
          : { body: { conversations: [sent], unreadTotal: 0, requestCount: 0 } },
    });

    expect(await screen.findByText('Waiting for Sam Rivera to accept.')).toBeInTheDocument();
    // Not a greyed-out line inside a box you cannot type in — there is no box.
    expect(screen.queryByLabelText('Message Sam Rivera')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('keeps a request out of the messages until it is accepted', async () => {
    const pending = { ...conversation, state: 'pending' as const, canSend: false };
    const api = renderMessages('/messages/c1', {
      'GET /api/conversations': ({ url }) =>
        url.includes('box=requests')
          ? { body: { conversations: [pending], unreadTotal: 0, requestCount: 1 } }
          : { body: { conversations: [], unreadTotal: 0, requestCount: 1 } },
      'POST /api/conversations/c1/accept': { body: { ...conversation } },
    });

    // The tab says how many are waiting.
    expect(await screen.findByRole('tab', { name: 'Requests (1 waiting)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Requests (1 waiting)' }));
    expect(await screen.findByText(/is not someone you follow/)).toBeInTheDocument();
    // No composer while it waits.
    expect(screen.queryByLabelText('Message Sam Rivera')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Accept message' }));
    await waitFor(() =>
      expect(api.calls.some((call) => call.path === '/api/conversations/c1/accept')).toBe(true),
    );
  });
});
