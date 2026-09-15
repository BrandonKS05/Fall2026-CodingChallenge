import type { Collection } from '@wumboo/shared';
import { PlusIcon } from 'lucide-react';
import { FloatingCard } from '@/components/common/FloatingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from './BoardCard';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

interface BoardGridProps {
  boards: Collection[];
  /** When given, blank cards with a plus fill the grid up to `fillTo` cells and open the creator. */
  onCreate?: () => void;
  fillTo?: number;
}

export function BoardGrid({ boards, onCreate, fillTo = 8 }: BoardGridProps) {
  // Always leave at least one blank card, so there is always a place to start the next board.
  const blanks = onCreate ? Math.max(1, fillTo - boards.length) : 0;
  return (
    <div className={GRID}>
      {boards.map((board, index) => (
        <FloatingCard key={board.id} index={index}>
          <BoardCard board={board} />
        </FloatingCard>
      ))}
      {Array.from({ length: blanks }, (_, index) => (
        <FloatingCard key={`blank-${index}`} index={boards.length + index}>
          <BlankBoardCard onClick={onCreate} />
        </FloatingCard>
      ))}
    </div>
  );
}

/** An empty frame waiting for a board: the same footprint as a real card, with a plus in the middle. */
function BlankBoardCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="New board"
      className="group flex h-full w-full flex-col rounded-xl p-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className="grid aspect-[4/3] w-full place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors group-hover:border-foreground/40 group-hover:text-foreground">
        <span className="grid size-10 place-items-center rounded-full border border-current">
          <PlusIcon className="size-5" />
        </span>
      </span>
      <span className="space-y-1 px-1 pt-2">
        <span className="block font-medium leading-tight text-muted-foreground group-hover:text-foreground">
          New board
        </span>
        <span className="block text-xs text-muted-foreground">Ready when you are</span>
      </span>
    </button>
  );
}

export function BoardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-busy aria-label="Loading boards">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 p-2">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
