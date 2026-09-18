/**
 * One picture at a time, with the board behind it blurred away: arrows to move
 * along the board, dots to say where you are in it, and the caption set apart
 * from the picture rather than pasted across its foot.
 */
import { imageTitle, type Item } from '@wumboo/shared';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ProfileLink } from '@/components/common/ProfileLink';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  /** Everything on the board, so the arrows have somewhere to go. */
  items: Item[];
  /** Which one is open, or null when the lightbox is closed. */
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  /**
   * How many a visitor may look at before the rest are behind the gate. Every
   * item is reachable when this is undefined, which is what a member gets.
   */
  free?: number | undefined;
  /** Shown over the first picture past the free ones. */
  onSignIn?: (() => void) | undefined;
  onSignUp?: (() => void) | undefined;
}

export function ImageLightbox({
  items,
  index,
  onIndex,
  onClose,
  free,
  onSignIn,
  onSignUp,
}: ImageLightboxProps) {
  const open = index !== null && items.length > 0;
  // A visitor gets the free ones plus a look at the next, blurred: a gate has
  // to be visible to be an invitation rather than a dead end.
  const reachable = free === undefined ? items.length : Math.min(items.length, free + 1);
  const at = Math.min(index ?? 0, reachable - 1);
  const item = open ? items[at] : undefined;
  const locked = free !== undefined && at >= free;
  const step = (by: number) => onIndex((((at + by) % reachable) + reachable) % reachable);

  // The arrows work from the keyboard too, which is how anyone looks through a
  // set of pictures without thinking about it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!item) return null;
  const title = item.caption || imageTitle(item.image.tags) || 'Untitled';
  const many = reachable > 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-background/70 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md"
        className="max-h-[92svh] w-[min(100vw-2rem,64rem)] max-w-none overflow-y-auto border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-none"
      >
        <figure className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center justify-center px-2 sm:px-14">
            <div className="relative">
              <img
                key={item.id}
                src={item.image.url}
                alt={locked ? '' : title}
                width={item.image.width}
                height={item.image.height}
                className={cn(
                  'max-h-[64svh] w-auto max-w-full rounded-2xl bg-muted object-contain shadow-2xl',
                  locked && 'pointer-events-none blur-[6px] select-none',
                )}
              />
              {locked && (
                <div className="absolute inset-0 grid place-items-center rounded-2xl px-4">
                  <div className="max-w-xs rounded-2xl bg-background/90 px-7 py-6 text-center shadow-lg backdrop-blur-xs">
                    <p className="font-hand text-4xl leading-none">There is more.</p>
                    <p className="mt-2 text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                      Sign in to see the rest of this board.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      <Button size="sm" onClick={onSignIn}>
                        Sign in
                      </Button>
                      <Button size="sm" variant="outline" onClick={onSignUp}>
                        Create an account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {many && (
                <>
                  <NudgeButton
                    side="left"
                    onClick={() => step(-1)}
                    label="Previous image"
                    disabled={at === 0}
                  />
                  <NudgeButton
                    side="right"
                    onClick={() => step(1)}
                    label="Next image"
                    disabled={at === reachable - 1}
                  />
                </>
              )}
            </div>
          </div>

          {/* The foot of the picture: who and what on the left, where you are on
              the right, on nothing at all. The blurred backdrop is already dark
              enough to read against, and a panel here was one more box between a
              person and a photograph. Two lines, both clipped, so a long caption
              or a fistful of tags can never become a third. */}
          <div className="flex w-full items-end justify-between gap-6 px-2 sm:px-14">
            <figcaption className={cn('min-w-0 flex-1 text-left', locked && 'invisible')}>
              <DialogTitle className="truncate text-base font-medium">{title}</DialogTitle>
              <DialogDescription className="mt-0.5 truncate text-sm">
                {'Added by '}
                <ProfileLink handle={item.addedBy.handle} className="text-foreground">
                  {item.addedBy.displayName}
                </ProfileLink>
                {` · ${timeAgo(item.createdAt)}`}
                {item.tags.length > 0 && ` · ${item.tags.map((tag) => `#${tag}`).join(' ')}`}
              </DialogDescription>
            </figcaption>

            {many && (
              <nav
                aria-label="Images on this board"
                className="flex shrink-0 items-center gap-2 pb-1.5"
              >
                {items.slice(0, reachable).map((candidate, dot) => (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-label={`Image ${dot + 1} of ${reachable}`}
                    aria-current={dot === at}
                    onClick={() => onIndex(dot)}
                    className={cn(
                      'size-2 rounded-full transition-colors',
                      dot === at ? 'bg-foreground' : 'bg-foreground/25 hover:bg-foreground/50',
                    )}
                  />
                ))}
              </nav>
            )}
          </div>
        </figure>
      </DialogContent>
    </Dialog>
  );
}

function NudgeButton({
  side,
  onClick,
  label,
  disabled,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  label: string;
  disabled: boolean;
}) {
  const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full',
        'bg-background/80 text-foreground shadow-md transition-transform hover:scale-105',
        'disabled:pointer-events-none disabled:bg-background/40 disabled:text-muted-foreground disabled:shadow-none',
        // Over the picture where there is no room, just outside it where there is.
        side === 'left' ? 'left-1 sm:-left-12' : 'right-1 sm:-right-12',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
