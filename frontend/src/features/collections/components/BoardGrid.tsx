import type { Collection } from '@wumboo/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from './BoardCard';

export function BoardGrid({ boards }: { boards: Collection[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} />
      ))}
    </div>
  );
}

export function BoardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      aria-busy
      aria-label="Loading boards"
    >
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
