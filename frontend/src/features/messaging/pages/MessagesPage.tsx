/**
 * Messages: conversations down the left, the open one on the right. The URL
 * carries the conversation (/messages/:id) so a thread can be linked to and the
 * back button walks between them.
 */
import type { ConversationSummary } from '@wumboo/shared';
import { MessageCircleIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import { MessagesLink } from '../components/MessagesLink';
import { useSession } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import { Composer } from '../components/Composer';
import { StartConversation } from '../components/StartConversation';
import { Thread } from '../components/Thread';
import { useInbox, useMarkRead } from '../queries';

export default function MessagesPage() {
  const { user } = useSession();
  const { id } = useParams();
  const inbox = useInbox(true);
  const conversations = inbox.data?.conversations ?? [];
  const open = conversations.find((row) => row.id === id);

  return (
    <div className="stage-surface flex min-h-svh flex-col bg-stage text-stage-ink">
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
            <StartConversation />
            {inbox.isPending ? (
              <p className="text-sm text-stage-ink/50">Looking…</p>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-stage-ink/50">
                No conversations yet. Start one with someone’s handle.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {conversations.map((conversation) => (
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
            {id ? <OpenConversation id={id} conversation={open} /> : <NothingOpen />}
          </section>
        </div>
      </main>
    </div>
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
        <span className="truncate font-medium">{name}</span>
        {conversation.unreadCount > 0 && (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-stage-ink text-[10px] font-semibold text-stage">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        )}
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-2 text-sm text-stage-ink/55">
        <span className="truncate">
          {preview ? `${fromYou ? 'You: ' : ''}${preview.body}` : `@${other?.handle ?? ''}`}
        </span>
        <span className="shrink-0 text-xs">{timeAgo(conversation.lastMessageAt)}</span>
      </span>
    </NavLink>
  );
}

function OpenConversation({
  id,
  conversation,
}: {
  id: string;
  conversation: ConversationSummary | undefined;
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
        <div className="min-w-0">
          <p className="truncate font-medium">{other?.displayName ?? 'Conversation'}</p>
          {other && <p className="truncate text-sm text-stage-ink/50">@{other.handle}</p>}
        </div>
      </header>

      <Thread conversationId={id} viewerId={user?.id} />
      <Composer conversationId={id} to={other?.displayName} />
    </div>
  );
}

function NothingOpen() {
  return (
    <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-stage-ink/15 p-10 text-center">
      <div>
        <MessageCircleIcon className="mx-auto size-8 text-stage-ink/30" aria-hidden />
        <p className="mt-3 text-sm text-stage-ink/55">
          Pick a conversation, or start one with a handle.
        </p>
      </div>
    </div>
  );
}
