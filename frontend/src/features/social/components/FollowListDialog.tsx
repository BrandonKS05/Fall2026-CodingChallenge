import type { ProfileSummary } from '@wumboo/shared';
import { Link } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFollowList } from '../queries';

/**
 * The count is the trigger. The list only loads when it is opened, and the
 * server decides whether this viewer may have it at all.
 */
export function FollowListDialog({
  handle,
  direction,
  count,
  open,
  onOpenChange,
  enabled,
}: {
  handle: string;
  direction: 'followers' | 'following';
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
}) {
  const list = useFollowList(handle, direction, open && enabled);
  const label = direction === 'followers' ? 'followers' : 'following';
  const heading = direction === 'followers' ? 'Followers' : 'Following';

  const trigger = (
    <span>
      <span className="font-semibold">{count}</span> {label}
    </span>
  );

  if (!enabled) {
    return <span className="text-stage-ink/60">{trigger}</span>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-stage-ink/60 underline-offset-4 transition-colors hover:text-stage-ink hover:underline"
          />
        }
      >
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        {list.isPending ? (
          <p className="text-sm text-muted-foreground">Looking…</p>
        ) : list.data && list.data.profiles.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto">
            {list.data.profiles.map((profile) => (
              <li key={profile.id}>
                <PersonRow profile={profile} onOpen={() => onOpenChange(false)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({ profile, onOpen }: { profile: ProfileSummary; onOpen: () => void }) {
  return (
    <Link
      to={`/u/${profile.handle}`}
      onClick={onOpen}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
      >
        {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{profile.displayName}</span>
        <span className="block truncate text-xs text-muted-foreground">@{profile.handle}</span>
      </span>
    </Link>
  );
}
