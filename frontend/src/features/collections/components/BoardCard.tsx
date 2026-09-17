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

/**
 * A board on a wall. Opening it opens the pictures where they are, so the card
 * is a button rather than a way off the page; the people who can change the
 * board get a quiet way through to the place where that is done.
 */
export function BoardCard({
  board,
  onOpen,
}: {
  board: Collection;
  onOpen?: ((id: string) => void) | undefined;
}) {
  const sharedWithMe = board.role !== null && board.role !== 'owner';
  const canManage = board.role === 'owner' || board.role === 'editor';
  return (
    <div className="group space-y-2">
      <button
        type="button"
        onClick={() => onOpen?.(board.id)}
        aria-label={`Open ${board.title}`}
        className="block w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stage-ink"
      >
        <div className="transition-transform duration-300 group-hover:-translate-y-1">
          <CoverMosaic imageIds={board.previewImageIds} title={board.title} />
        </div>
        <div className="px-1 pt-2">
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
      </button>
      {canManage && (
        <Link
          to={`/boards/${board.id}`}
          className="ml-1 inline-block text-xs tracking-[0.15em] text-stage-ink/50 uppercase underline-offset-4 hover:text-stage-ink hover:underline"
        >
          Manage
        </Link>
      )}
    </div>
  );
}
