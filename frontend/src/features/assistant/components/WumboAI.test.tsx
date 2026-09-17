import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, type StubRoute } from '@/testing/render';
import { WumboAI } from './WumboAI';

function renderWidget(chat: StubRoute = { body: { reply: 'Requests hold the first message.' } }) {
  const api = stubApi({ 'POST /api/chat': chat });
  vi.stubGlobal('fetch', api.fetchMock);
  render(<WumboAI />);
  return api;
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Ask Wumbo AI' }));

describe('WumboAI', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('sends on Enter and answers in the panel, with the question sent as typed', async () => {
    const api = renderWidget();
    await open();

    await userEvent.type(
      screen.getByLabelText('Ask Wumbo AI anything'),
      'How do message requests work?{Enter}',
    );

    expect(await screen.findByText('Requests hold the first message.')).toBeInTheDocument();
    expect(screen.getByText('How do message requests work?')).toBeInTheDocument();
    const call = api.calls.find((entry) => entry.path === '/api/chat');
    expect(call?.body).toMatchObject({
      message: 'How do message requests work?',
      conversation_history: [],
    });
    // The box empties, ready for the next one.
    expect(screen.getByLabelText('Ask Wumbo AI anything')).toHaveValue('');
  });

  it('sends with the button too, and replays the conversation so far', async () => {
    const api = renderWidget();
    await open();

    await userEvent.type(screen.getByLabelText('Ask Wumbo AI anything'), 'first');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Requests hold the first message.');

    await userEvent.type(screen.getByLabelText('Ask Wumbo AI anything'), 'second');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(api.calls.filter((entry) => entry.path === '/api/chat')).toHaveLength(2),
    );
    const second = api.calls.filter((entry) => entry.path === '/api/chat')[1];
    expect(second?.body).toMatchObject({
      message: 'second',
      conversation_history: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'Requests hold the first message.' },
      ],
    });
  });

  it('apologises when the service cannot be reached, and keeps that out of the history', async () => {
    const api = renderWidget({ status: 503, body: { detail: 'down' } });
    await open();

    await userEvent.type(screen.getByLabelText('Ask Wumbo AI anything'), 'hello{Enter}');
    expect(await screen.findByText(/couldn't reach my brain/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Ask Wumbo AI anything'), 'again{Enter}');
    await waitFor(() =>
      expect(api.calls.filter((entry) => entry.path === '/api/chat')).toHaveLength(2),
    );
    // An apology is not something the model said, so it is not replayed to it.
    expect(api.calls[1]?.body).toMatchObject({
      conversation_history: [{ role: 'user', content: 'hello' }],
    });
  });

  it('keeps the conversation for the tab, so a refresh does not lose it', async () => {
    const { unmount } = { unmount: () => undefined };
    renderWidget();
    await open();
    await userEvent.type(screen.getByLabelText('Ask Wumbo AI anything'), 'hello{Enter}');
    await screen.findByText('Requests hold the first message.');
    unmount();

    expect(sessionStorage.getItem('wumbo-ai:conversation')).toContain('hello');
  });

  it('offers openers while the panel is empty', async () => {
    renderWidget();
    await open();

    const suggestions = screen.getAllByRole('button', { name: /\?$/ });
    expect(suggestions.length).toBeGreaterThan(0);
    await userEvent.click(suggestions[0] as HTMLElement);
    expect(await screen.findByText('Requests hold the first message.')).toBeInTheDocument();
  });
});
