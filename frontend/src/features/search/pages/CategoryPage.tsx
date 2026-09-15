/**
 * One category: a banner saying what it holds, the pictures in it, and a few
 * neighbouring categories at the bottom. The same stage, the same chrome, and
 * the same saving flow as searching by words — a category is just a search
 * without the words.
 */
import { searchCategorySchema } from '@wumboo/shared';
import type { Collection, SearchResult } from '@wumboo/shared';
import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { StageChrome } from '@/components/common/StageChrome';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { useBoards, useCreateBoard } from '@/features/collections';
import { SaveToBoardDialog } from '@/features/items';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { cn } from '@/lib/utils';
import { CATEGORIES, DEFAULT_NEAR, NEAR } from '../categories';
import { ResultGrid, ResultGridSkeleton } from '../components/ResultGrid';
import { EMPTY_FILTERS, toImageQuery } from '../filters';
import { useImageSearch } from '../queries';

export default function CategoryPage() {
  const { name = '' } = useParams();
  const parsed = searchCategorySchema.safeParse(name);
  const category = parsed.success ? parsed.data : null;
  const look = category ? CATEGORIES[category] : null;

  const { user } = useSession();
  const boards = useBoards(user !== null);
  const createBoard = useCreateBoard();
  const search = useImageSearch(
    toImageQuery({ ...EMPTY_FILTERS, category: category ?? undefined }),
  );
  const [picking, setPicking] = useState<SearchResult | null>(null);
  const [savedTo, setSavedTo] = useState<Record<string, string>>({});
  const results = search.data?.pages.flatMap((page) => page.results) ?? [];

  function markSaved(result: SearchResult, board: Collection) {
    setSavedTo((current) => ({ ...current, [result.providerImageId]: board.title }));
    toast.success(`Saved to “${board.title}”`);
  }

  return (
    <div className="flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome
        signedIn={user !== null}
        position="sticky"
        leading={
          <span className="stage-surface flex items-center gap-1">
            <NotificationBell user={user} />
            <MessagesLink signedIn={user !== null} />
          </span>
        }
      />

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pt-4 pb-20 sm:px-6">
        {!category || !look ? (
          <div className="mt-16 text-center">
            <p className="font-hand text-5xl leading-none">No such category.</p>
            <Link to="/explore" className="mt-3 inline-block text-sm underline underline-offset-4">
              Back to Explore
            </Link>
          </div>
        ) : (
          <>
            <header className="relative overflow-hidden rounded-2xl px-6 py-12 text-center sm:py-16">
              <span
                aria-hidden
                className={cn('absolute inset-0 bg-linear-to-br', look.from, look.to)}
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-linear-to-t from-stage via-stage/40 to-transparent"
              />
              <div className="relative">
                <Link
                  to="/explore"
                  className="text-[11px] tracking-[0.2em] text-stage-ink/70 uppercase underline-offset-4 hover:underline"
                >
                  Back to Explore
                </Link>
                <h1 className="mt-3 text-4xl leading-none font-medium tracking-tight uppercase sm:text-6xl">
                  {look.label}
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm text-stage-ink/80">{look.blurb}</p>
              </div>
            </header>

            <nav
              aria-label="Related categories"
              className="mt-6 flex flex-wrap justify-center gap-2"
            >
              {(NEAR[category] ?? DEFAULT_NEAR)
                .filter((near) => near !== category)
                .map((near) => (
                  <Link
                    key={near}
                    to={`/c/${near}`}
                    className="flex items-center gap-2 rounded-full border border-stage-ink/25 px-3 py-1 text-xs text-stage-ink/70 transition-colors hover:border-stage-ink/60 hover:text-stage-ink"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 rounded-full bg-linear-to-br',
                        CATEGORIES[near].from,
                        CATEGORIES[near].to,
                      )}
                    />
                    {CATEGORIES[near].label}
                  </Link>
                ))}
            </nav>

            <section
              aria-label={`${look.label} images`}
              className="stage-surface mt-8 text-stage-ink"
            >
              {search.isPending ? (
                <ResultGridSkeleton />
              ) : search.error ? (
                <EmptyState
                  icon={<ImageOffIcon />}
                  title="Could not load this category"
                  description={search.error.message}
                  action={
                    <Button variant="outline" onClick={() => void search.refetch()}>
                      Try again
                    </Button>
                  }
                />
              ) : (
                <ResultGrid
                  results={results}
                  savedTo={savedTo}
                  onSave={setPicking}
                  hasMore={Boolean(search.hasNextPage)}
                  loadingMore={search.isFetchingNextPage}
                  onLoadMore={() => void search.fetchNextPage()}
                />
              )}
            </section>
          </>
        )}
      </main>

      <SaveToBoardDialog
        result={picking}
        user={user}
        boards={boards.data ?? []}
        onClose={() => setPicking(null)}
        onSaved={(board) => picking && markSaved(picking, board)}
        onCreateBoard={(title) =>
          createBoard.mutateAsync({ title, description: '', visibility: 'private' })
        }
      />
    </div>
  );
}
