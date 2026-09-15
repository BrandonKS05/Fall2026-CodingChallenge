import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** Wordmark plus the same glyph as the favicon. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-foreground text-background text-sm font-bold"
      >
        W
      </span>
      <span className="text-lg">Wumboo</span>
    </Link>
  );
}
