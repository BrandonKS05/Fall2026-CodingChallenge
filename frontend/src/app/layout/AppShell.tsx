import { type ReactNode } from 'react';
import { StageChrome } from '@/components/common/StageChrome';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useSession } from '@/features/auth';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';

/**
 * The shell for the pages that are not full-bleed stages. It wears the same
 * chrome as the landing page — one top row everywhere — and adds the two
 * controls only the signed-in app needs.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();

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
        trailing={
          <span className="stage-surface ml-1 flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </span>
        }
      />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
