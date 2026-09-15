/**
 * Explore is the one place to look for anything: search the free-photo library
 * and save what you find, or, with the box empty, browse every image on every
 * public board. Filters live behind one button rather than spread across the
 * page, because there are now a great many of them.
 */
import type { Collection, ExploreImage, SearchResult } from '@wumboo/shared';
import { ChevronDownIcon, ImageOffIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  JustifiedRows,
  JustifiedRowsSkeleton,
  type JustifiedTile,
} from '@/components/common/JustifiedRows';
import { StageButton } from '@/components/common/StageButton';
import { StageChrome } from '@/components/common/StageChrome';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { SaveToBoardDialog, useSaveToBoard } from '@/features/items';
import {
  FilterPanel,
  readFilters,
  ResultGrid,
  ResultGridSkeleton,
  SearchBar,
  useImageSearch,
  writeFilters,
  type SearchFilters,
} from '@/features/search';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBoards, useCreateBoard } from '../queries';
import { useExploreImages } from '../queries';

/** The API's ceiling; five seed boards fill forty of these. */
const FEED_LIMIT = 60;
/** How many images a visitor sees sharp before the rest blur behind a sign-in prompt. */
const FREE_PREVIEW = 15;

type Order = 'newest' | 'oldest';

interface BoardOption {
  id: string;
  title: string;
  count: number;
}

/** The boards behind the feed, in first-appearance order, with how many images each contributes. */
function boardsIn(images: ExploreImage[]): BoardOption[] {
  const seen = new Map<string, BoardOption>();
  for (const { collection } of images) {
    const option = seen.get(collection.id);
    if (option) option.count += 1;
    else seen.set(collection.id, { id: collection.id, title: collection.title, count: 1 });
  }
  return [...seen.values()];
}

const SUGGESTIONS = [
  'warm kitchen',
  'fog over pines',
  'brutalist library',
  'tide pools',
  'neon rain',
];

export default function ExplorePage() {
  const { user } = useSession();
  const auth = useAuthDialog();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const searching = filters.q.trim().length > 0;
  const feed = useExploreImages(FEED_LIMIT);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('newest');

  const images = useMemo(() => feed.data ?? [], [feed.data]);
  const boards = useMemo(() => boardsIn(images), [images]);
  const shown = useMemo(() => {
    const ofBoard = boardId ? images.filter((entry) => entry.collection.id === boardId) : images;
    return order === 'newest' ? ofBoard : [...ofBoard].reverse();
  }, [images, boardId, order]);
  const boardLabel = boards.find((board) => board.id === boardId)?.title ?? 'All boards';

  const boardsQuery = useBoards(user !== null);
  const createBoard = useCreateBoard();
  const quickSave = useSaveToBoard();
  const search = useImageSearch(filters);
  const [picking, setPicking] = useState<SearchResult | null>(null);
  const [savedTo, setSavedTo] = useState<Record<string, string>>({});
  const targetBoardId = params.get('board');
  const targetBoard = boardsQuery.data?.find(
    (board) => board.id === targetBoardId && (board.role === 'owner' || board.role === 'editor'),
  );
  const results = search.data?.pages.flatMap((page) => page.results) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;

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
            // Already on the board counts as saved; anything else is worth saying.
            if (error.code === 'CONFLICT') markSaved(result, targetBoard);
            else toast.error(error.message);
          },
        },
      );
      return;
    }
    setPicking(result);
  }

  const setFilters = (next: SearchFilters) => {
    const nextParams = writeFilters(next);
    const board = params.get('board');
    if (board) nextParams.set('board', board);
    setParams(nextParams, { replace: true });
  };
  // Visitors get a taste; the rest waits behind the sign-in card, which opens right here.
  const gated = user === null && shown.length > FREE_PREVIEW;
  const sharp = gated ? shown.slice(0, FREE_PREVIEW) : shown;
  const locked = gated ? shown.slice(FREE_PREVIEW) : [];

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

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pt-4 sm:px-6">
        <header className="flex items-end justify-between gap-4 border-b border-stage-ink/30 pb-4">
          <h1 className="text-5xl leading-none font-medium tracking-tight uppercase sm:text-7xl">
            Explore
          </h1>
          <p className="text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
            {feed.data
              ? `${pluralize(shown.length, 'image')} · ${pluralize(boards.length, 'board')}`
              : ' '}
          </p>
        </header>
        <p className="sr-only">Search the free-photo library, or browse the public boards below.</p>

        <div className="stage-surface mt-5 flex items-center gap-2">
          <SearchBar filters={filters} onChange={setFilters} />
          <FilterPanel filters={filters} onChange={setFilters} />
        </div>

        {targetBoard && (
          <p className="stage-surface mt-3 rounded-lg border border-stage-ink/20 px-3 py-2 text-sm text-stage-ink">
            Saving straight into <strong>{targetBoard.title}</strong>.{' '}
            <Link to={`/boards/${targetBoard.id}`} className="underline underline-offset-4">
              Back to the board
            </Link>
          </p>
        )}

        {!searching && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setFilters({ ...filters, q: suggestion })}
                className="rounded-full border border-stage-ink/25 px-3 py-1 text-xs text-stage-ink/70 transition-colors hover:border-stage-ink/60 hover:text-stage-ink"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {searching ? (
          <section aria-label="Search results" className="stage-surface mt-6 text-stage-ink">
            {search.isPending ? (
              <ResultGridSkeleton />
            ) : search.error ? (
              <EmptyState
                icon={<ImageOffIcon />}
                title="Search is unavailable right now"
                description={search.error.message}
                action={
                  <Button variant="outline" onClick={() => void search.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon={<SearchIcon />}
                title={`Nothing for “${filters.q}”`}
                description="Try fewer words, or loosen a filter."
              />
            ) : (
              <>
                <p className="mb-4 text-sm text-stage-ink/60">
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
                <p className="mt-8 text-center text-xs text-stage-ink/50">
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
              </>
            )}
          </section>
        ) : feed.isPending ? (
          <JustifiedRowsSkeleton label="Loading public images" className="mt-6" />
        ) : feed.isError ? (
          <Notice>Could not load the public boards. Try again in a moment.</Notice>
        ) : shown.length === 0 ? (
          <Notice>Nothing public yet. Make a board public and it will show up here.</Notice>
        ) : (
          <>
            <JustifiedRows label="Public images" tiles={toTiles(sharp)} className="mt-6" />
            {gated && (
              <LockedGallery
                images={locked}
                total={shown.length}
                onSignIn={() => auth.open({ mode: 'login' })}
                onSignUp={() => auth.open({ mode: 'register' })}
              />
            )}
          </>
        )}
      </main>

      <SaveToBoardDialog
        result={picking}
        user={user}
        boards={boardsQuery.data ?? []}
        onClose={() => setPicking(null)}
        onSaved={(board) => picking && markSaved(picking, board)}
        onCreateBoard={(title) =>
          createBoard.mutateAsync({ title, description: '', visibility: 'private' })
        }
      />

      {/* The browse filters, docked, and only while there is something to browse. */}
      <div
        className={cn(
          'pointer-events-none sticky bottom-0 z-40 justify-center px-4 pt-10 pb-4',
          searching ? 'hidden' : 'flex',
        )}
      >
        <div className="pointer-events-auto flex divide-x divide-stage-ink/20 overflow-hidden rounded-md bg-stage-ink/10 text-[11px] tracking-[0.2em] uppercase shadow-lg ring-1 ring-stage-ink/15 backdrop-blur-md">
          <FilterMenu label="Board" value={boardLabel}>
            <DropdownMenuItem onClick={() => setBoardId(null)}>All boards</DropdownMenuItem>
            {boards.map((board) => (
              <DropdownMenuItem key={board.id} onClick={() => setBoardId(board.id)}>
                {board.title}
                <span className="ml-auto pl-4 text-muted-foreground">{board.count}</span>
              </DropdownMenuItem>
            ))}
          </FilterMenu>
          <FilterMenu label="Order" value={order === 'newest' ? 'Newest first' : 'Oldest first'}>
            <DropdownMenuItem onClick={() => setOrder('newest')}>Newest first</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOrder('oldest')}>Oldest first</DropdownMenuItem>
          </FilterMenu>
        </div>
      </div>
    </div>
  );
}

/**
 * Justified rows: every tile keeps its aspect ratio at a fixed row height and
 * grows in proportion to its width, so each row fills the line edge to edge.
 * The trailing spacer stops the last row from stretching.
 */
function toTiles(images: ExploreImage[]): JustifiedTile[] {
  return images.map(({ image, collection }) => ({
    id: image.id,
    src: http.url(`/images/${image.id}`),
    aspect: image.width / image.height,
    href: `/boards/${collection.id}`,
    label: `Open ${collection.title}`,
  }));
}

/**
 * The rest of the feed for visitors: the same rows, blurred and inert, capped
 * to a couple of rows and fading into the stage, with the invitation on top.
 */
function LockedGallery({
  images,
  total,
  onSignIn,
  onSignUp,
}: {
  images: ExploreImage[];
  total: number;
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="relative mt-2 max-h-[min(60svh,520px)] overflow-hidden sm:mt-3">
      <JustifiedRows tiles={toTiles(images)} blurred />
      <div className="absolute inset-0 bg-linear-to-b from-stage/20 via-stage/40 to-stage" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="max-w-sm border border-stage-ink/40 bg-stage/80 px-8 py-7 text-center backdrop-blur-sm">
          <p className="font-hand text-5xl leading-none">There is more.</p>
          <p className="mt-3 text-[11px] tracking-[0.2em] text-stage-ink/70 uppercase">
            {FREE_PREVIEW} of {pluralize(total, 'image')} shown. Sign in to see the rest.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <StageButton onClick={onSignIn}>Sign in</StageButton>
            <StageButton variant="outline" onClick={onSignUp}>
              Create an account
            </StageButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterMenu({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="flex items-center gap-2 px-5 py-3 transition-colors hover:bg-stage-ink/10"
          />
        }
      >
        <span className="text-stage-ink/60">{label}</span>
        <span>{value}</span>
        <ChevronDownIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8} className="min-w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-16 text-center text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
      {children}
    </p>
  );
}
