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
    'GET /api/conversations': { body: { conversations: [conversation], unreadTotal: 2 } },
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
      screen.getByText('Pick a conversation, or start one with a handle.'),
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

  it('starts a conversation from a handle, and says so when nobody has it', async () => {
    const api = renderMessages('/messages', {
      'POST /api/conversations': ({ body }) =>
        (body as { handle: string }).handle === 'sam'
          ? { status: 201, body: conversation }
          : {
              status: 404,
              body: { error: { code: 'NOT_FOUND', message: 'User not found' } },
            },
    });

    const field = await screen.findByLabelText('New message');
    await userEvent.type(field, 'ghost');
    await userEvent.click(screen.getByRole('button', { name: 'Write' }));
    expect(await screen.findByText('Nobody here goes by @ghost.')).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, '@SAM');
    await userEvent.click(screen.getByRole('button', { name: 'Write' }));

    // Opening the new conversation also posts a read, so match the start call by path.
    await waitFor(() =>
      expect(
        api.calls.filter((call) => call.method === 'POST' && call.path === '/api/conversations'),
      ).toMatchObject([{ body: { handle: 'ghost' } }, { body: { handle: 'sam' } }]),
    );
    expect(await screen.findByLabelText('Message Sam Rivera')).toBeInTheDocument();
  });
});
