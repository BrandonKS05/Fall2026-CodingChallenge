import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** Wordmark styling matches the landing-page chrome. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center text-[clamp(1.6rem,2vw,2.4rem)] font-black tracking-[-0.09em] uppercase leading-none text-current',
        className,
      )}
    >
      WUMBOO
    </Link>
  );
}
