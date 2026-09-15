import type { Collection } from '@wumboo/shared';
import { PlusIcon } from 'lucide-react';
import { FloatingCard } from '@/components/common/FloatingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from './BoardCard';

const LANDING_SLOTS = [
  { x: 6, y: 8, width: 18 },
  { x: 28, y: 14, width: 16 },
  { x: 48, y: 12, width: 18 },
  { x: 68, y: 20, width: 16 },
  { x: 18, y: 42, width: 18 },
  { x: 42, y: 42, width: 18 },
  { x: 64, y: 48, width: 14 },
  { x: 12, y: 68, width: 16 },
  { x: 30, y: 72, width: 18 },
  { x: 54, y: 72, width: 16 },
] as const;

const GRID = 'relative min-h-[80vh] w-full overflow-hidden rounded-[2rem] bg-stage text-stage-ink';

interface BoardGridProps {
  boards: Collection[];
  /** When given, blank cards with a plus fill the grid up to `fillTo` cells and open the creator. */
  onCreate?: () => void;
  fillTo?: number;
}

export function BoardGrid({ boards, onCreate, fillTo = 8 }: BoardGridProps) {
  const blanks = onCreate ? Math.max(1, fillTo - boards.length) : 0;
  const slots = LANDING_SLOTS.slice(0, Math.max(boards.length, 1));
  const allCards = [...boards, ...Array.from({ length: blanks }, () => null)];

  return (
    <div className={GRID}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.04),transparent_25%)]" />
      <div className="absolute inset-[-10%]">
        {allCards.map((board, index) => {
          const slot = slots[index % slots.length] ?? LANDING_SLOTS[LANDING_SLOTS.length - 1];
          const isBlank = board === null;
          return (
            <div
              key={isBlank ? `blank-${index}` : board.id}
              className="absolute"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}vw`,
              }}
            >
              <FloatingCard index={index}>
                {isBlank ? (
                  <BlankBoardCard onClick={onCreate} />
                ) : (
                  <BoardCard board={board} />
                )}
              </FloatingCard>
            </div>
          );
        })}
      </div>
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
      <span className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-stage-ink/15 bg-stage-ink/5 text-stage-ink/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] transition-colors group-hover:border-stage-ink/30 group-hover:text-stage-ink">
        <span className="grid size-12 place-items-center rounded-full border border-current/40 bg-white/5">
          <PlusIcon className="size-6" />
        </span>
      </span>
      <span className="space-y-1 px-1 pt-2">
        <span className="block font-medium leading-tight text-stage-ink/80 group-hover:text-stage-ink">
          New board
        </span>
        <span className="block text-xs text-stage-ink/60">Ready when you are</span>
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
