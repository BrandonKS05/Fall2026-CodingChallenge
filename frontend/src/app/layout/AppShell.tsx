import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

const links = [
  { to: '/', label: 'Discover', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/boards', label: 'My boards' },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Logo />
          <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
