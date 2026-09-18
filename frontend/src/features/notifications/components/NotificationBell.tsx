import { BellIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useInbox, useMarkRead } from '../queries';
import { describeNotification } from '../text';

import type { User } from '@wumboo/shared';

export function NotificationBell({ user }: { user: User | null }) {
  const inbox = useInbox(Boolean(user));
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;
  const notifications = inbox.data?.notifications ?? [];
  const unread = inbox.data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <BellIcon />
        {unread > 0 && (
          // On the button's corner rather than on the bell itself: a 16px glyph
          // centred in a 32px button leaves no room for a chip that is not
          // sitting on top of it. The ring is the surface colour, so the count
          // reads as being in front of the bell rather than drawn across it.
          // The same treatment as the messages badge beside it, deliberately.
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-stage-ink px-1 text-[9px] leading-none font-semibold text-stage ring-2 ring-background"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markRead.mutate(undefined)}>
              Mark all read
            </Button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto border-t" aria-label="Notifications">
          {notifications.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </li>
          )}
          {notifications.map((notification) => {
            const isUnread = notification.readAt === null;
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                    isUnread && 'bg-accent/40',
                  )}
                  onClick={() => {
                    if (isUnread) markRead.mutate([notification.id]);
                    setOpen(false);
                    // A welcome is not about a board, so there is nowhere to go.
                    if (notification.collection) navigate(`/boards/${notification.collection.id}`);
                  }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      isUnread ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug">
                      {describeNotification(notification, user.id)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
