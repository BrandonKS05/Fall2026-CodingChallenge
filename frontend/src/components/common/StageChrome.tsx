/**
 * The chrome shared by the dark full-bleed pages (landing, Explore, boards):
 * the wordmark top-left and the site links top-right, in the same spot on
 * every page so they read as one global control. Color transitions only:
 * these pages animate things underneath, and an opacity animation would get
 * its own compositor layer.
 */
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { cn } from '@/lib/utils';

interface StageChromeProps {
  signedIn: boolean;
  /**
   * Sits at the start of the links, and after them. Slots rather than fixed
   * controls, because this is a shared component and the things that go in them
   * belong to features.
   */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** `absolute` floats over a fixed stage; `sticky` rides along a scrolling page. */
  position?: 'absolute' | 'sticky';
}

const link = ({ isActive }: { isActive: boolean }) =>
  cn('transition-colors hover:text-stage-ink/70', isActive && 'underline underline-offset-4');

export function StageChrome({
  signedIn,
  leading,
  trailing,
  position = 'absolute',
}: StageChromeProps) {
  const auth = useAuthDialog();
  return (
    <header
      className={cn(
        'inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5',
        position === 'absolute'
          ? 'absolute'
          : 'sticky bg-linear-to-b from-stage via-stage/80 to-transparent',
      )}
    >
      <Link
        to="/"
        className="text-xl leading-none font-bold tracking-tighter uppercase [font-stretch:condensed] sm:text-2xl"
      >
        Wumboo
      </Link>
      <nav
        aria-label="Site"
        className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase sm:gap-3 sm:text-[11px]"
      >
        {leading}
        <NavLink to="/explore" className={link}>
          Explore
        </NavLink>
        <span aria-hidden>·</span>
        <NavLink to="/boards" className={link}>
          Boards
        </NavLink>
        <span aria-hidden>·</span>
        {signedIn ? (
          <NavLink to="/discover" className={link}>
            Discover
          </NavLink>
        ) : (
          <Link
            to="/login"
            onClick={auth.intercept({ mode: 'login' })}
            className="transition-colors hover:text-stage-ink/70"
          >
            Sign in
          </Link>
        )}
        {trailing}
      </nav>
    </header>
  );
}
