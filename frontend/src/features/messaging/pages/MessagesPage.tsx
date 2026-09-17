/**
 * Messages: conversations down the left, the open one on the right. The URL
 * carries the conversation (/messages/:id) so a thread can be linked to and the
 * back button walks between them.
 *
 * Two boxes. Messages holds the conversations you have taken; Requests holds the
 * ones that arrived from someone you do not follow, each waiting on a single
 * opening message until you accept it.
 */
import type { ConversationBox, ConversationSummary } from '@wumboo/shared';
import { MessageCircleIcon, SearchIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import { Input } from '@/components/ui/input';
import { useSession } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { ProfileLink, useFollowList } from '@/features/social';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import { Composer } from '../components/Composer';
import { MessagesLink } from '../components/MessagesLink';
import { NewMessageDialog } from '../components/NewMessageDialog';
import { AwaitingAccept } from '../components/AwaitingAccept';
import { RequestNotice } from '../components/RequestNotice';
import { Thread } from '../components/Thread';
import { useInbox, useMarkRead } from '../queries';

export default function MessagesPage() {
  const { user } = useSession();
  const { id } = useParams();
  const [box, setBox] = useState<ConversationBox>('inbox');
  const [search, setSearch] = useState('');

  const inbox = useInbox(true, box);
  const conversations = inbox.data?.conversations ?? [];
  const requestCount = inbox.data?.requestCount ?? 0;
  const open = conversations.find((row) => row.id === id);
  // The picker offers the people you follow; nobody else has a chat waiting.
  const following = useFollowList(user?.handle ?? '', 'following', true);

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? conversations.filter((conversation) => matches(conversation, needle))
    : conversations;

  return (
    <div className="flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome
        signedIn={user !== null}
        position="sticky"
        leading={
          <span className="stage-surface flex items-center gap-1">
            <NotificationBell user={user} />
            <MessagesLink signedIn={user !== null} />
          </span>
        }
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-10 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Messages</h1>

        <div className="mt-8 grid flex-1 gap-6 md:grid-cols-[19rem_1fr] md:gap-10">
          <section
            aria-label="Conversations"
            className={cn('min-w-0 flex-col gap-3', id ? 'hidden md:flex' : 'flex')}
          >
            <div className="stage-surface flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages"
                  aria-label="Search messages"
                  autoComplete="off"
                  className="h-9 pl-8"
                />
              </div>
              <NewMessageDialog
                people={following.data?.profiles ?? []}
                loading={following.isPending}
              />
            </div>

            <div role="tablist" aria-label="Message boxes" className="flex gap-4 text-sm">
              <BoxTab current={box} value="inbox" label="Messages" onSelect={setBox} />
              <BoxTab
                current={box}
                value="requests"
                label="Requests"
                count={requestCount}
                onSelect={setBox}
              />
            </div>

            {inbox.isPending ? (
              <p className="text-sm text-stage-ink/50">Looking…</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-stage-ink/50">
                {needle
                  ? 'Nothing matches that.'
                  : box === 'requests'
                    ? 'No requests waiting.'
                    : 'No conversations yet. Start one from the pencil, or from someone’s profile.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {shown.map((conversation) => (
                  <li key={conversation.id}>
                    <ConversationRow conversation={conversation} viewerId={user?.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Conversation"
            className={cn('min-w-0 flex-col', id ? 'flex' : 'hidden md:flex')}
          >
            {id ? (
              <OpenConversation id={id} conversation={open} onAccepted={() => setBox('inbox')} />
            ) : (
              <NothingOpen />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/** Search looks where a person would: the name, the handle, and the last line. */
function matches(conversation: ConversationSummary, needle: string): boolean {
  const people = conversation.participants.map((person) =>
    `${person.displayName} ${person.handle}`.toLowerCase(),
  );
  return (
    people.some((person) => person.includes(needle)) ||
    (conversation.lastMessage?.body.toLowerCase().includes(needle) ?? false)
  );
}

function BoxTab({
  current,
  value,
  label,
  count = 0,
  onSelect,
}: {
  current: ConversationBox;
  value: ConversationBox;
  label: string;
  count?: number;
  onSelect: (box: ConversationBox) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={count > 0 ? `${label} (${count} waiting)` : label}
      onClick={() => onSelect(value)}
      className={cn(
        'flex items-center gap-1.5 border-b-2 pb-1.5 transition-colors',
        selected
          ? 'border-stage-ink font-semibold text-stage-ink'
          : 'border-transparent text-stage-ink/55 hover:text-stage-ink',
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <>
          <span aria-hidden>({count})</span>
          {/* The blue dot: something is waiting, without a number to read. */}
          <span aria-hidden className="size-2 rounded-full bg-sky-400" />
        </>
      )}
    </button>
  );
}

function ConversationRow({
  conversation,
  viewerId,
}: {
  conversation: ConversationSummary;
  viewerId: string | undefined;
}) {
  const other = conversation.participants[0];
  const name = other?.displayName ?? 'Someone';
  const preview = conversation.lastMessage;
  const fromYou = preview?.senderId === viewerId;
  // Unread reads as bold, the way a mail list has always said it.
  const unread = conversation.unreadCount > 0;

  return (
    <NavLink
      to={`/messages/${conversation.id}`}
      className={({ isActive }) =>
        cn(
          'block rounded-xl px-3 py-2.5 transition-colors',
          isActive ? 'bg-stage-ink/10' : 'hover:bg-stage-ink/5',
        )
      }
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={cn('truncate', unread ? 'font-bold' : 'font-medium')}>{name}</span>
        {unread && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stage-ink text-[10px] font-semibold text-stage">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        )}
      </span>
      <span
        className={cn(
          'mt-0.5 flex items-baseline justify-between gap-2 text-sm',
          unread ? 'font-semibold text-stage-ink' : 'text-stage-ink/55',
        )}
      >
        <span className="truncate">
          {preview ? `${fromYou ? 'You: ' : ''}${preview.body}` : `@${other?.handle ?? ''}`}
        </span>
        <span className="shrink-0 text-xs font-normal text-stage-ink/45">
          {timeAgo(conversation.lastMessageAt)}
        </span>
      </span>
    </NavLink>
  );
}

function OpenConversation({
  id,
  conversation,
  onAccepted,
}: {
  id: string;
  conversation: ConversationSummary | undefined;
  onAccepted: () => void;
}) {
  const { user } = useSession();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  // Opening a conversation is reading it; mark it once per conversation.
  const marked = useRef<string | null>(null);

  useEffect(() => {
    if (marked.current === id) return;
    marked.current = id;
    markRead.mutate(id);
  }, [id, markRead]);

  const other = conversation?.participants[0];
  const pending = conversation?.state === 'pending';
  // The other side of a request: sent, and nothing more to do until they accept.
  const waiting = !pending && conversation?.canSend === false;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-stage-ink/15">
      <header className="flex items-center gap-3 border-b border-stage-ink/15 px-4 py-3">
        <button
          type="button"
          onClick={() => void navigate('/messages')}
          className="text-sm text-stage-ink/60 transition-colors hover:text-stage-ink md:hidden"
        >
          Back
        </button>
        <div className={cn('min-w-0', waiting && 'opacity-45')}>
          <p className="truncate font-medium">{other?.displayName ?? 'Conversation'}</p>
          {other && (
            <p className="truncate text-sm text-stage-ink/50">
              <ProfileLink handle={other.handle}>@{other.handle}</ProfileLink>
            </p>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            waiting && 'pointer-events-none opacity-30 grayscale',
          )}
        >
          <Thread conversationId={id} viewerId={user?.id} />
        </div>
        {waiting && <AwaitingAccept name={other?.displayName} />}
      </div>

      {pending ? (
        <RequestNotice conversationId={id} from={other?.displayName} onAccepted={onAccepted} />
      ) : waiting ? null : (
        <Composer conversationId={id} to={other?.displayName} />
      )}
    </div>
  );
}

function NothingOpen() {
  return (
    <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-stage-ink/15 p-10 text-center">
      <div>
        <MessageCircleIcon className="mx-auto size-8 text-stage-ink/30" aria-hidden />
        <p className="mt-3 text-sm text-stage-ink/55">
          Pick a conversation, or start one with the pencil.
        </p>
      </div>
    </div>
  );
}
