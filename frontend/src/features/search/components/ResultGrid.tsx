import type { SearchResult } from '@trove/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { ResultCard } from './ResultCard';

interface ResultGridProps {
  results: SearchResult[];
  savedTo: Record<string, string>;
  onSave: (result: SearchResult) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function ResultGrid({ results, savedTo, onSave, hasMore, loadingMore, onLoadMore }: ResultGridProps) {
  // Auto-load as the sentinel nears the viewport; the button is the keyboard and no-observer fallback.
  const sentinel = useIntersectionObserver<HTMLDivElement>(() => {
    if (hasMore && !loadingMore) onLoadMore();
  }, { enabled: hasMore });

  return (
    <div className="space-y-6">
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {results.map((result) => (
          <ResultCard
            key={`${result.provider}:${result.providerImageId}`}
            result={result}
            savedTo={savedTo[result.providerImageId]}
            onSave={onSave}
          />
        ))}
      </div>
      <div ref={sentinel} className="flex justify-center">
        {hasMore && (
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ResultGridSkeleton() {
  const heights = ['h-52', 'h-72', 'h-44', 'h-64', 'h-56', 'h-40', 'h-60', 'h-48'];
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4" aria-busy aria-label="Searching">
      {heights.map((height, index) => (
        <Skeleton key={index} className={`mb-4 w-full break-inside-avoid rounded-xl ${height}`} />
      ))}
    </div>
  );
}
