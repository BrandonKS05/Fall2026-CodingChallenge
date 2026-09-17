import type { Collection } from '@wumboo/shared';
import { Link } from 'react-router';
import { pluralize, timeAgo } from '@/lib/format';
import { CoverMosaic } from './CoverMosaic';

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
