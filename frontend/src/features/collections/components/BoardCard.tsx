import type { Collection } from '@trove/shared';
import { ImageIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VisibilityBadge } from './VisibilityBadge';

/** One big image and up to two small ones, like a real pinboard cover. */
function CoverMosaic({ imageIds, title }: { imageIds: string[]; title: string }) {
  if (imageIds.length === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-lg bg-muted text-muted-foreground">
        <ImageIcon className="size-8" />
      </div>
    );
  }
  const [first, ...rest] = imageIds;
  return (
    <div
      className={cn(
        'grid aspect-[4/3] gap-1 overflow-hidden rounded-lg',
        rest.length > 0 ? 'grid-cols-3' : 'grid-cols-1',
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
          className="h-full w-full object-cover"
        />
      ))}
      <span className="sr-only">Preview of {title}</span>
    </div>
  );
}

export function BoardCard({ board }: { board: Collection }) {
  const sharedWithMe = board.role !== null && board.role !== 'owner';
  return (
    <Link
      to={`/boards/${board.id}`}
      className="group block space-y-2 rounded-xl p-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <CoverMosaic imageIds={board.previewImageIds} title={board.title} />
      <div className="space-y-1 px-1">
        <h3 className="truncate font-medium leading-tight">{board.title}</h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{pluralize(board.itemCount, 'image')}</span>
          <VisibilityBadge visibility={board.visibility} />
          {sharedWithMe && (
            <Badge variant="secondary" className="font-normal">
              {board.role === 'editor' ? 'Editor' : 'Viewer'} · {board.owner.displayName}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
