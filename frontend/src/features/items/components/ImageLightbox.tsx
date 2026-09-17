/**
 * One picture at a time, with the board behind it blurred away: arrows to move
 * along the board, dots to say where you are in it, and the caption set apart
 * from the picture rather than pasted across its foot.
 */
import { imageTitle, type Item } from '@wumboo/shared';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
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
}

export function ImageLightbox({ items, index, onIndex, onClose }: ImageLightboxProps) {
  const open = index !== null && items.length > 0;
  const item = open ? items[Math.min(index, items.length - 1)] : undefined;
  const step = (by: number) =>
    onIndex(((((index ?? 0) + by) % items.length) + items.length) % items.length);

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
  const many = items.length > 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-background/70 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md"
        className="max-h-[92svh] w-[min(100vw-2rem,64rem)] max-w-none overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <figure className="flex flex-col items-center gap-4">
          <div className="relative flex w-full items-center justify-center">
            {many && <NudgeButton side="left" onClick={() => step(-1)} label="Previous image" />}
            <img
              key={item.id}
              src={item.image.url}
              alt={title}
              width={item.image.width}
              height={item.image.height}
              className="max-h-[64svh] w-auto max-w-full rounded-2xl bg-muted object-contain shadow-2xl"
            />
            {many && <NudgeButton side="right" onClick={() => step(1)} label="Next image" />}
          </div>

          {/* Apart from the picture, on its own panel: the caption is not a strip
              of paint across the bottom of someone's photograph. */}
          <figcaption className="w-full max-w-2xl rounded-2xl bg-background/95 px-5 py-4 text-center shadow-lg">
            <DialogTitle className="text-base font-medium">{title}</DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
              <span>
                Added by{' '}
                <ProfileLink handle={item.addedBy.handle} className="text-foreground">
                  {item.addedBy.displayName}
                </ProfileLink>
              </span>
              <span aria-hidden>·</span>
              <span>{timeAgo(item.createdAt)}</span>
            </DialogDescription>
            {item.tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {item.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    #{tag}
                  </li>
                ))}
              </ul>
            )}
          </figcaption>

          {many && (
            <nav aria-label="Images on this board" className="flex flex-wrap justify-center gap-2">
              {items.map((candidate, at) => (
                <button
                  key={candidate.id}
                  type="button"
                  aria-label={`Image ${at + 1} of ${items.length}`}
                  aria-current={at === index}
                  onClick={() => onIndex(at)}
                  className={cn(
                    'size-2 rounded-full transition-colors',
                    at === index ? 'bg-foreground' : 'bg-foreground/25 hover:bg-foreground/50',
                  )}
                />
              ))}
            </nav>
          )}
        </figure>
      </DialogContent>
    </Dialog>
  );
}

function NudgeButton({
  side,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  label: string;
}) {
  const Icon = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute z-10 grid size-10 place-items-center rounded-full bg-background/80 text-foreground shadow-md transition-transform hover:scale-105',
        side === 'left' ? 'left-0 sm:-left-5' : 'right-0 sm:-right-5',
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
