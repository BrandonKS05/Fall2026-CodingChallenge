/**
 * Explore is the one place to look for anything: search the free-photo library
 * and save what you find, or, with the box empty, browse every image on every
 * public board. Filters live behind one button rather than spread across the
 * page, because there are now a great many of them.
 */
import type { Collection, ExploreImage, ProfileSummary, SearchResult } from '@wumboo/shared';
import { ImageOffIcon, SearchIcon } from 'lucide-react';
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
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { BoardCard } from '../components/BoardCard';
import { useBoards, useBoardSearch, useCreateBoard } from '../queries';
import { useExploreImages } from '../queries';

/** The API's ceiling; five seed boards fill forty of these. */
const FEED_LIMIT = 60;
/** How many images a visitor sees sharp before the rest blur behind a sign-in prompt. */
const FREE_PREVIEW = 15;

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
  const feed = useExploreImages(FEED_LIMIT);

  const images = useMemo(() => feed.data ?? [], [feed.data]);
  const shown = images;

  const boardsQuery = useBoards(user !== null);
  const createBoard = useCreateBoard();
  const quickSave = useSaveToBoard();
  const search = useImageSearch(imageQuery, wantsImages);
  const [picking, setPicking] = useState<SearchResult | null>(null);
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
              <BoardResults term={term} only={!wantsImages && !wantsPeople} />
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

        {!searching && (
          <CategoryGrid
            className="mt-10"
            heading="Browse by category"
            categories={ALL_CATEGORIES}
          />
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
function BoardResults({ term, only }: { term: string; only: boolean }) {
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
            <BoardCard key={board.id} board={board} />
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
