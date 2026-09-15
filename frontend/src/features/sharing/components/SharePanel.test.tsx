import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBoard } from '@/features/collections/queries';
import { boardFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { SharePanel } from './SharePanel';

const board = boardFixture();
const owner = {
  userId: 'u1',
  email: 'ada@example.com',
  displayName: 'Ada',
  role: 'owner',
  joinedAt: board.createdAt,
};
const friend = {
  userId: 'u2',
  email: 'grace@example.com',
  displayName: 'Grace',
  role: 'editor',
  joinedAt: board.createdAt,
};

/** Renders the panel the way the board page does: bound to the cached board, so link changes show up. */
function Harness({ initial, currentUserId }: { initial: typeof board; currentUserId: string }) {
  const cached = useBoard(initial.id).data?.collection ?? initial;
  return <SharePanel board={cached} currentUserId={currentUserId} />;
}

function renderPanel(routes: Record<string, StubRoute>, props = { board, currentUserId: 'u1' }) {
  const api = stubApi({
    [`GET /api/collections/${board.id}/members`]: { body: { members: [owner] } },
    [`GET /api/collections/${board.id}`]: { body: { collection: props.board, items: [] } },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<Harness initial={props.board} currentUserId={props.currentUserId} />);
  return api;
}

describe('SharePanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lets the owner create a link and shows it as a copyable URL', async () => {
    // The GET stub reflects the link once created, as the real API would after the refetch.
    let current = board;
    const api = renderPanel({
      [`GET /api/collections/${board.id}`]: () => ({ body: { collection: current, items: [] } }),
      [`POST /api/collections/${board.id}/share-link`]: () => {
        current = { ...current, shareSlug: 'abc123XYZ_-', visibility: 'unlisted' };
        return { body: { slug: 'abc123XYZ_-' } };
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create link' }));

    expect(await screen.findByRole('textbox', { name: 'Share link' })).toHaveValue(
      `${window.location.origin}/s/abc123XYZ_-`,
    );
    expect(
      api.calls.some((call) => call.method === 'POST' && call.path.endsWith('/share-link')),
    ).toBe(true);
  });

  it('invites by email, changes roles, and removes members', async () => {
    let members = [owner, friend];
    const api = renderPanel({
      [`GET /api/collections/${board.id}/members`]: () => ({ body: { members } }),
      [`POST /api/collections/${board.id}/members`]: (call) => {
        const body = call.body as { email: string; role: string };
        members = [
          ...members,
          { ...friend, userId: 'u3', email: body.email, displayName: 'Linus', role: body.role },
        ];
        return { status: 201, body: members[members.length - 1] };
      },
      [`PATCH /api/collections/${board.id}/members/u2`]: (call) => {
        members = members.map((m) =>
          m.userId === 'u2' ? { ...m, role: (call.body as { role: string }).role } : m,
        );
        return { body: members[1] };
      },
      [`DELETE /api/collections/${board.id}/members/u2`]: () => {
        members = members.filter((m) => m.userId !== 'u2');
        return { status: 204 };
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    const list = await screen.findByRole('list', { name: 'Members' });
    expect(await within(list).findAllByRole('listitem')).toHaveLength(2);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Invite by email' }),
      'linus@example.com',
    );
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Role for the invitation' })).getByRole(
        'radio',
        { name: 'Viewer' },
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));
    expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
      email: 'linus@example.com',
      role: 'viewer',
    });

    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Role for Grace' })).getByRole('radio', {
        name: 'Viewer',
      }),
    );
    await waitFor(() => expect(api.calls.some((call) => call.method === 'PATCH')).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Remove Grace' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
  });

  it('shows the unknown-email message from the API', async () => {
    renderPanel({
      [`POST /api/collections/${board.id}/members`]: {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'No account with that email' } },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    await userEvent.type(
      await screen.findByRole('textbox', { name: 'Invite by email' }),
      'ghost@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No account with that email');
  });

  it('gives non-owners the link, the list, and a way to leave', async () => {
    renderPanel(
      { [`GET /api/collections/${board.id}/members`]: { body: { members: [owner, friend] } } },
      { board: { ...board, role: 'editor', shareSlug: 'zzz' }, currentUserId: 'u2' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('textbox', { name: 'Share link' })).toHaveValue(
      `${window.location.origin}/s/zzz`,
    );
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Invite by email' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Leave this board' })).toBeInTheDocument();
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });
});
