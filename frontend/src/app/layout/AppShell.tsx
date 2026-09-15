import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useSession } from '@/features/auth';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const links: NavItem[] = [
  { to: '/explore', label: 'Explore' },
  { to: '/boards', label: 'Boards' },
  { to: '/discover', label: 'Discover' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const primaryLink = user
    ? { to: '/discover', label: 'Discover' }
    : { to: '/login', label: 'Sign in' };

  return (
    <div className="flex min-h-svh flex-col bg-stage text-stage-ink">
      <header className="sticky top-0 z-40 border-b border-stage-ink/10 bg-stage text-stage-ink">
        <div className="mx-auto flex h-20 w-full max-w-[1500px] items-center justify-between gap-6 px-6">
          <Logo className="text-stage-ink" />

          <nav
            aria-label="Primary"
            className="flex items-center gap-4 text-[11px] tracking-[0.2em] uppercase text-stage-ink/80"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'transition-colors hover:text-stage-ink',
                    isActive ? 'text-stage-ink' : 'text-stage-ink/70',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink to={primaryLink.to} className="transition-colors hover:text-stage-ink">
              {primaryLink.label}
            </NavLink>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 text-stage-ink">
            <MessagesLink signedIn={user !== null} />
            <NotificationBell user={user} />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
