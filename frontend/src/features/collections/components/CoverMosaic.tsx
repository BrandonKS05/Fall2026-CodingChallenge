import { http } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * A board's cover, the way an album sleeve reads: one big picture with two
 * smaller ones filling the rest of the rectangle. A board with one picture
 * gives it the whole frame; an empty one is a plain panel.
 */
export function CoverMosaic({
  imageIds,
  title,
  className,
}: {
  imageIds: string[];
  title: string;
  className?: string;
}) {
  const [first, ...rest] = imageIds;
  if (!first) {
    return (
      <div
        aria-hidden
        className={cn(
          'aspect-[4/3] rounded-2xl border border-stage-ink/15 bg-stage-ink/10',
          className,
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        'grid aspect-[4/3] gap-0.5 overflow-hidden rounded-2xl bg-stage-ink/10',
        rest.length > 0 ? 'grid-cols-3 grid-rows-2' : 'grid-cols-1',
        className,
      )}
    >
      <img
        src={http.url(`/images/${first}`)}
        alt=""
        loading="lazy"
        className={cn('h-full w-full object-cover', rest.length > 0 && 'col-span-2 row-span-2')}
      />
      {rest.slice(0, 2).map((id) => (
        <img
          key={id}
          src={http.url(`/images/${id}`)}
          alt=""
          loading="lazy"
          // Two pictures fill the sleeve between them rather than leaving a hole.
          className={cn('h-full w-full object-cover', rest.length === 1 && 'row-span-2')}
        />
      ))}
      <span className="sr-only">Preview of {title}</span>
    </div>
  );
}
