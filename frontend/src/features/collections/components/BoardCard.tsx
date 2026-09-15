import type { Collection } from '@wumboo/shared';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { pluralize } from '@/lib/format';
import { VisibilityBadge } from './VisibilityBadge';

function PlusCover({ title }: { title: string }) {
  return (
    <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-stage-ink/15 bg-stage-ink/5 text-stage-ink/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <span className="grid size-12 place-items-center rounded-full border border-current/40 bg-white/5 text-3xl font-light leading-none">
        +
      </span>
      <span className="sr-only">Preview of {title}</span>
    </div>
  );
}

export function BoardCard({ board }: { board: Collection }) {
  const sharedWithMe = board.role !== null && board.role !== 'owner';
  return (
    <Link
      to={`/boards/${board.id}`}
      aria-label={`Open ${board.title}`}
      className="group block space-y-2 rounded-xl p-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <PlusCover title={board.title} />
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
