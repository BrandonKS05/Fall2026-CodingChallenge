/**
 * Explore is the one place to look for anything: search the free-photo library,
 * the public boards, and the people who keep them, or — with the box empty —
 * browse those boards as a wall of album covers. Filters live behind one
 * button rather than spread across the page, because there are many of them.
 */
import type { Collection, ProfileSummary, SearchResult } from '@wumboo/shared';
import { ImageOffIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { LockedPreview } from '@/components/common/LockedPreview';
import { StageChrome } from '@/components/common/StageChrome';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { SaveToBoardDialog, useSaveToBoard } from '@/features/items';
import { PersonRow, useProfileSearch } from '@/features/social';
import {
  ALL_CATEGORIES,
  CATEGORIES,
  CategoryGrid,
  FilterPanel,
  ImageSearchButton,
  readFilters,
  ResultGrid,
  ResultGridSkeleton,
  scopeIncludes,
  SearchBar,
  searchTerm,
  toImageQuery,
  useImageSearch,
  writeFilters,
  type SearchFilters,
} from '@/features/search';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BoardCard } from '../components/BoardCard';
import { RecommendedRow } from '@/features/recommendations';
import { BoardCarousel } from '../components/BoardCarousel';
import { CoverMosaic } from '../components/CoverMosaic';
import { useBoards, useBoardSearch, useCreateBoard, useExploreBoards } from '../queries';

/** How many public boards the wall holds before it stops asking for more. */
const FEED_LIMIT = 48;
/** How many albums a visitor sees sharp — two rows — before the rest blur. */
const FREE_PREVIEW = 8;

const SUGGESTIONS = [
  'warm kitchen',
  'fog over pines',
  'brutalist library',
  'tide pools',
  'neon rain',
];

export default function ExplorePage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  // Three kinds of thing can answer a search; the box and the panel decide which.
  const term = searchTerm(filters);
  const wantsImages = scopeIncludes(filters, 'images');
  const wantsBoards = scopeIncludes(filters, 'collections');
  const wantsPeople = scopeIncludes(filters, 'people');
  const imageQuery = toImageQuery(filters);
  const narrowed =
    imageQuery.category !== undefined ||
    imageQuery.color !== undefined ||
    imageQuery.colorHex !== undefined;
  const searching = term !== '' || (wantsImages && narrowed);
  const feed = useExploreBoards(FEED_LIMIT, !searching);

  const shown = useMemo(() => feed.data?.collections ?? [], [feed.data]);

  const boardsQuery = useBoards(user !== null);
  const createBoard = useCreateBoard();
  const quickSave = useSaveToBoard();
  const search = useImageSearch(imageQuery, wantsImages);
  const [picking, setPicking] = useState<SearchResult | null>(null);
  // A board opens here, over the wall, rather than on a page of its own.
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<Record<string, string>>({});
  const targetBoardId = params.get('board');
  const targetBoard = boardsQuery.data?.find(
    (board) => board.id === targetBoardId && (board.role === 'owner' || board.role === 'editor'),
  );
  const results = search.data?.pages.flatMap((page) => page.results) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;
  // With no words, say what is being searched instead: a category, or a colour.
  const subject =
    term !== ''
      ? `“${term}”`
      : filters.category
        ? CATEGORIES[filters.category].label.toLowerCase()
        : 'that colour';

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

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pt-4 pb-20 sm:px-6">
        <header className="border-b border-stage-ink/30 pb-4">
          <h1 className="text-5xl leading-none font-medium tracking-tight uppercase sm:text-7xl">
            Explore
          </h1>
        </header>
        <p className="sr-only">Search the free-photo library, or browse the public boards below.</p>

        <div className="stage-surface mt-5 flex items-center gap-2">
          <SearchBar filters={filters} onChange={setFilters} />
          <ImageSearchButton filters={filters} onChange={setFilters} />
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
          <div className="mt-6 space-y-12">
            {wantsPeople && term !== '' && (
              <PeopleResults term={term} only={!wantsImages && !wantsBoards} />
            )}
            {wantsBoards && term !== '' && (
              <BoardResults term={term} only={!wantsImages && !wantsPeople} onOpen={setOpenBoard} />
            )}
            {wantsImages && (
              <section aria-label="Images" className="stage-surface text-stage-ink">
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
                    title={`Nothing for ${subject}`}
                    description="Try fewer words, or loosen a filter."
                  />
                ) : (
                  <>
                    <p className="mb-4 text-sm text-stage-ink/60">
                      {total.toLocaleString()} results for {subject}
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
            )}
          </div>
        ) : feed.isPending ? (
          <AlbumWallSkeleton />
        ) : feed.isError ? (
          <Notice>Could not load the public boards. Try again in a moment.</Notice>
        ) : shown.length === 0 ? (
          <Notice>Nothing public yet. Make a board public and it will show up here.</Notice>
        ) : (
          <>
            <AlbumWall
              label="Public boards"
              boards={sharp}
              className="mt-8"
              onOpen={setOpenBoard}
            />
            {gated && <LockedGallery boards={locked} />}
          </>
        )}

        {!searching && (
          <>
            <RecommendedRow className="mt-10" signedIn={user !== null} onOpen={setOpenBoard} />
            <CategoryGrid
              className="mt-10"
              heading="Browse by category"
              categories={ALL_CATEGORIES}
            />
          </>
        )}
      </main>

      <BoardCarousel
        collectionId={openBoard}
        signedIn={user !== null}
        onClose={() => setOpenBoard(null)}
      />

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
    </div>
  );
}

/**
 * People matching the words. Silent while something else is still answering;
 * only a search that was for people alone says "nobody".
 */
function PeopleResults({ term, only }: { term: string; only: boolean }) {
  const people = useProfileSearch(term, true);
  const found: ProfileSummary[] = people.data?.profiles ?? [];
  if (!only && (people.isPending || found.length === 0)) return null;

  return (
    <section aria-label="People" className="stage-surface text-stage-ink">
      <SectionHeading>People</SectionHeading>
      {found.length === 0 ? (
        <Notice>Nobody by that name. A handle is searched with an @ in front of it.</Notice>
      ) : (
        <ul className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {found.map((profile) => (
            <li key={profile.id}>
              <PersonRow profile={profile} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Public boards whose title or description carries the words. */
function BoardResults({
  term,
  only,
  onOpen,
}: {
  term: string;
  only: boolean;
  onOpen: (id: string) => void;
}) {
  const boards = useBoardSearch(term, true);
  const found = boards.data?.collections ?? [];
  if (!only && (boards.isPending || found.length === 0)) return null;

  return (
    <section aria-label="Boards" className="text-stage-ink">
      <SectionHeading>Boards</SectionHeading>
      {found.length === 0 ? (
        <Notice>No public board by that name.</Notice>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {found.map((board) => (
            <BoardCard key={board.id} board={board} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-stage-ink/20 pb-3 text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
      {children}
    </h2>
  );
}

/**
 * The wall of public boards: each one an album sleeve — a big picture with two
 * smaller ones filling the rest of the frame — with room between them, so the
 * eye has somewhere to rest between covers.
 */
function AlbumWall({
  boards,
  label,
  blurred = false,
  className,
  onOpen = () => undefined,
}: {
  boards: Collection[];
  label?: string;
  blurred?: boolean;
  className?: string;
  onOpen?: (id: string) => void;
}) {
  return (
    <ul
      aria-label={label}
      aria-hidden={blurred || undefined}
      className={cn(
        'grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-7 sm:gap-y-11 lg:grid-cols-4',
        blurred && 'blur-[5px] select-none',
        className,
      )}
    >
      {boards.map((board) => (
        <li key={board.id}>
          <Album board={board} inert={blurred} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function Album({
  board,
  inert,
  onOpen,
}: {
  board: Collection;
  inert: boolean;
  onOpen: (id: string) => void;
}) {
  const cover = (
    <>
      <CoverMosaic
        className="transition-transform duration-300 group-hover:-translate-y-1"
        imageIds={board.previewImageIds}
        title={board.title}
      />
      <p className="mt-3 truncate text-sm leading-tight font-medium">{board.title}</p>
      <p className="truncate text-[11px] tracking-[0.2em] text-stage-ink/50 uppercase">
        {pluralize(board.itemCount, 'image')} · {board.owner.displayName}
      </p>
    </>
  );
  if (inert) return <div className="group block">{cover}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(board.id)}
      aria-label={`Open ${board.title}`}
      className="group block w-full text-left rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stage-ink"
    >
      {cover}
    </button>
  );
}

function AlbumWallSkeleton() {
  return (
    <div
      aria-busy
      aria-label="Loading public boards"
      className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-7 sm:gap-y-11 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index}>
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stage-ink/10" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-stage-ink/10" />
        </div>
      ))}
    </div>
  );
}

/**
 * The rest of the wall for visitors: the same albums, blurred and inert, with
 * the invitation on top.
 */
function LockedGallery({ boards }: { boards: Collection[] }) {
  return (
    <LockedPreview tone="stage" className="mt-9 sm:mt-11" message="Sign in to see the rest.">
      <AlbumWall boards={boards} blurred />
    </LockedPreview>
  );
}

/**
 * Justified rows: every tile keeps its aspect ratio at a fixed row height and
 * grows in proportion to its width, so each row fills the line edge to edge.
 * The trailing spacer stops the last row from stretching.
 */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-16 text-center text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
      {children}
    </p>
  );
}
