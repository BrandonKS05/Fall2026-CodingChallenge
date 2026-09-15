import type { Collection } from '@wumboo/shared';
import { Link } from 'react-router';
import { http } from '@/lib/api';
import { pluralize, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

/** One big picture and up to two small ones, the way a pinboard cover reads at a glance. */
function CoverMosaic({ imageIds, title }: { imageIds: string[]; title: string }) {
  const [first, ...rest] = imageIds;
  if (!first) {
    return (
      <div
        aria-hidden
        className="aspect-[4/3] rounded-2xl border border-stage-ink/15 bg-stage-ink/10"
      />
    );
  }
  return (
    <div
      className={cn(
        'grid aspect-[4/3] gap-0.5 overflow-hidden rounded-2xl bg-stage-ink/10',
        rest.length > 0 ? 'grid-cols-3 grid-rows-2' : 'grid-cols-1',
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

const VISIBILITY: Record<Collection['visibility'], string> = {
  private: 'Private',
  unlisted: 'Link only',
  followers: 'Followers',
  public: 'Public',
};

export function BoardCard({ board }: { board: Collection }) {
  const sharedWithMe = board.role !== null && board.role !== 'owner';
  return (
    <Link
      to={`/boards/${board.id}`}
      aria-label={`Open ${board.title}`}
      className="group block space-y-2 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stage-ink"
    >
      <div className="transition-transform duration-300 group-hover:-translate-y-1">
        <CoverMosaic imageIds={board.previewImageIds} title={board.title} />
      </div>
      <div className="px-1">
        <h3 className="truncate text-lg leading-tight font-semibold">{board.title}</h3>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-stage-ink/60">
          <span>{pluralize(board.itemCount, 'image')}</span>
          <span>{pluralize(board.likeCount, 'like')}</span>
          <span>{timeAgo(board.updatedAt)}</span>
          <span>{VISIBILITY[board.visibility]}</span>
          {sharedWithMe && (
            <span>
              {board.role === 'editor' ? 'Editor' : 'Viewer'} · {board.owner.displayName}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
