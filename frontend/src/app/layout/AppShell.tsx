import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { useSession } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const links: NavItem[] = [
  { to: '/discover', label: 'Discover' },
  { to: '/explore', label: 'Explore' },
  { to: '/boards', label: 'My boards' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <Logo />
          {/* One row at every width: labels never wrap, and on a phone the nav scrolls sideways instead. */}
          <nav
            aria-label="Primary"
            className="flex min-w-0 items-center gap-1 overflow-x-auto text-xs [scrollbar-width:none] sm:text-sm"
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-md px-2 py-1.5 whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <NotificationBell user={user} />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
