import { Skeleton } from '@/components/ui/skeleton';

/** Suspense fallback shaped like a page so lazy chunks never flash blank. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
