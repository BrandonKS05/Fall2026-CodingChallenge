/**
 * Discover composes three features: search (results), items (saving), and
 * collections (which boards exist). Pages are where features meet.
 */
import { searchColorSchema, type Collection, type SearchResult } from '@wumboo/shared';
import { ImageOffIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/queries';
import { useBoards, useCreateBoard } from '@/features/collections/queries';
import { SaveToBoardDialog } from '@/features/items/components/SaveToBoardDialog';
import { useSaveToBoard } from '@/features/items/queries';
import { ResultGrid, ResultGridSkeleton } from '../components/ResultGrid';
import { SearchBar, type Orientation, type SearchFilters } from '../components/SearchBar';
import { useImageSearch } from '../queries';

const SUGGESTIONS = [
  'warm kitchen',
  'fog over pines',
  'brutalist library',
  'tide pools',
  'neon rain',
];

function readFilters(params: URLSearchParams): SearchFilters {
  const orientation = params.get('orientation');
  const color = searchColorSchema.safeParse(params.get('color'));
  return {
    q: params.get('q') ?? '',
    orientation:
      orientation === 'horizontal' || orientation === 'vertical'
        ? orientation
        : ('all' as Orientation),
    ...(color.success && { color: color.data }),
  };
}

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const targetBoardId = params.get('board');

  const { user } = useSession();
  const boards = useBoards(user !== null);
  const createBoard = useCreateBoard();
  const quickSave = useSaveToBoard();
  const search = useImageSearch(filters);

  const [picking, setPicking] = useState<SearchResult | null>(null);
  const [savedTo, setSavedTo] = useState<Record<string, string>>({});

  const targetBoard = boards.data?.find(
    (board) => board.id === targetBoardId && (board.role === 'owner' || board.role === 'editor'),
  );

  function writeFilters(next: SearchFilters) {
    const nextParams = new URLSearchParams();
    if (next.q) nextParams.set('q', next.q);
    if (next.orientation !== 'all') nextParams.set('orientation', next.orientation);
    if (next.color) nextParams.set('color', next.color);
    if (targetBoardId) nextParams.set('board', targetBoardId);
    setParams(nextParams, { replace: true });
  }

  function markSaved(result: SearchResult, board: Collection) {
    setSavedTo((current) => ({ ...current, [result.providerImageId]: board.title }));
    toast.success(`Saved to “${board.title}”`, {
      action: { label: 'View board', onClick: () => window.location.assign(`/boards/${board.id}`) },
    });
  }

  function handleSave(result: SearchResult) {
    if (user && targetBoard) {
      // Arrived from a board's "Add images": one click saves straight into it.
      quickSave.mutate(
        {
          collectionId: targetBoard.id,
          body: {
            provider: result.provider,
            providerImageId: result.providerImageId,
            caption: '',
            tags: [],
          },
        },
        {
          onSuccess: () => markSaved(result, targetBoard),
          onError: (error) => {
            // Already on the board counts as saved; anything else is worth telling the user.
            if (error.code === 'CONFLICT') markSaved(result, targetBoard);
            else toast.error(error.message);
          },
        },
      );
      return;
    }
    setPicking(result);
  }

  const results = search.data?.pages.flatMap((page) => page.results) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  const searching = filters.q.trim().length > 0;

  return (
    <div className="space-y-6">
      {!searching && (
        <section className="mx-auto max-w-2xl space-y-3 pt-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Find it again.</h1>
          <p className="text-muted-foreground">
            Search millions of free photos, save the ones you love to boards, and share them with
            people who will actually look.
          </p>
        </section>
      )}

      <div className="mx-auto max-w-3xl space-y-3">
        {targetBoard && (
          <p className="rounded-lg border bg-accent/50 px-3 py-2 text-sm">
            Saving straight into <strong>{targetBoard.title}</strong>.{' '}
            <Link to={`/boards/${targetBoard.id}`} className="underline underline-offset-4">
              Back to the board
            </Link>
          </p>
        )}
        <SearchBar filters={filters} onChange={writeFilters} autoFocus={!searching} />
        {!searching && (
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => writeFilters({ ...filters, q: suggestion })}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>

      {searching && search.isPending && <ResultGridSkeleton />}

      {searching && search.error && (
        <EmptyState
          icon={<ImageOffIcon />}
          title="Search is unavailable right now"
          description={search.error.message}
          action={
            <Button variant="outline" onClick={() => search.refetch()}>
              Try again
            </Button>
          }
        />
      )}

      {searching && search.data && results.length === 0 && (
        <EmptyState
          icon={<SearchIcon />}
          title={`Nothing for “${filters.q}”`}
          description="Try fewer words, or a different color or shape."
        />
      )}

      {results.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} results for “{filters.q}”
          </p>
          <ResultGrid
            results={results}
            savedTo={savedTo}
            onSave={handleSave}
            hasMore={Boolean(search.hasNextPage)}
            loadingMore={search.isFetchingNextPage}
            onLoadMore={() => void search.fetchNextPage()}
          />
        </>
      )}

      {searching && (
        <p className="text-center text-xs text-muted-foreground">
          Photos from{' '}
          <a
            href="https://pixabay.com/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Pixabay
          </a>
        </p>
      )}

      <SaveToBoardDialog
        result={picking}
        user={user}
        boards={boards.data ?? []}
        onClose={() => setPicking(null)}
        onSaved={(board) => {
          if (picking) markSaved(picking, board);
          setPicking(null);
        }}
        onCreateBoard={(title) =>
          createBoard.mutateAsync({ title, description: '', visibility: 'private' })
        }
      />
    </div>
  );
}
