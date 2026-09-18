import { MessageCircleIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { useInbox } from '../queries';

/**
 * The way into messages, and the only place unread mail is announced. It sits
 * left of the site links in the chrome, so it reads as part of the same row
 * without taking a word of it.
 */
export function MessagesLink({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const inbox = useInbox(signedIn);
  const unread = inbox.data?.unreadTotal ?? 0;
  if (!signedIn) return null;

  return (
    <Link
      to="/messages"
      aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
      className={cn(
        // Matches the notification bell beside it: a 32px target, a 16px glyph.
        'relative inline-flex size-8 items-center justify-center rounded-full transition-colors',
        className,
      )}
    >
      <MessageCircleIcon className="size-4" aria-hidden />
      {/* The same chip as the notification bell beside it. */}
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-stage-ink px-1 text-[9px] leading-none font-semibold text-stage ring-2 ring-background"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
