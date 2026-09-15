import type { ProfileSummary } from '@wumboo/shared';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/**
 * One person, wherever people are listed: the name they show, the handle they
 * are found by, and a way to their page. The initial stands in for a picture,
 * which nobody has yet.
 */
export function PersonRow({
  profile,
  onOpen,
  className,
}: {
  profile: ProfileSummary;
  onOpen?: () => void;
  className?: string;
}) {
  return (
    <Link
      to={`/u/${profile.handle}`}
      onClick={onOpen}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
      >
        {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{profile.displayName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          @{profile.handle}
          {profile.followedByViewer && ' · Following'}
        </span>
      </span>
    </Link>
  );
}
