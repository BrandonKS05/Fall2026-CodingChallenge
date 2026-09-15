/**
 * Explore: every image on every public board, laid out as justified rows the
 * way a studio's "all work" page is, on the same dark stage as the landing.
 * Filters dock at the bottom so the pictures keep the whole width.
 */
import type { ExploreImage } from '@wumboo/shared';
import { ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { useSession } from '@/features/auth';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
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

export default function ExplorePage() {
  const { user } = useSession();
  const auth = useAuthDialog();
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
        <p className="sr-only">Public boards from everyone on Wumboo, newest first.</p>

        {feed.isPending ? (
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

      {/* Docked filters, like a contact sheet's tabs: they stay put while the rows scroll under them. */}
      <div className="pointer-events-none sticky bottom-0 z-40 flex justify-center px-4 pt-10 pb-4">
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
