/**
 * Explore: every image on every public board, laid out as justified rows the
 * way a studio's "all work" page is, on the same dark stage as the landing.
 * Filters dock at the bottom so the pictures keep the whole width.
 */
import type { ExploreImage } from '@wumboo/shared';
import { ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useExploreImages } from '../queries';

/** The API's ceiling; five seed boards fill forty of these. */
const FEED_LIMIT = 60;

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

  return (
    <div className="flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome signedIn={user !== null} position="sticky" />

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
          <GallerySkeleton />
        ) : feed.isError ? (
          <Notice>Could not load the public boards. Try again in a moment.</Notice>
        ) : shown.length === 0 ? (
          <Notice>Nothing public yet. Make a board public and it will show up here.</Notice>
        ) : (
          <Gallery images={shown} />
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
function Gallery({ images }: { images: ExploreImage[] }) {
  return (
    <ul
      aria-label="Public images"
      className="mt-6 flex flex-wrap gap-2 [--row:120px] sm:gap-3 sm:[--row:180px]"
    >
      {images.map(({ image, collection }) => {
        const aspect = image.width / image.height;
        return (
          <li
            key={image.id}
            className="group relative"
            style={{
              flexGrow: aspect,
              flexBasis: `calc(${aspect} * var(--row))`,
              height: 'var(--row)',
            }}
          >
            <Link
              to={`/boards/${collection.id}`}
              aria-label={`Open ${collection.title}`}
              className="block h-full w-full"
            >
              <img
                src={http.url(`/images/${image.id}`)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-[2px] object-cover"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-stage/80 to-transparent px-2 pt-6 pb-1.5 text-[10px] tracking-[0.2em] text-stage-ink uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {collection.title}
              </span>
            </Link>
          </li>
        );
      })}
      <li aria-hidden className="h-0" style={{ flexGrow: 1_000_000 }} />
    </ul>
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

function GallerySkeleton() {
  const widths = [1.5, 1, 0.8, 1.78, 1.2, 0.75, 1.5, 1, 1.33, 0.9, 1.6, 1.1];
  return (
    <ul
      aria-busy
      aria-label="Loading public images"
      className="mt-6 flex flex-wrap gap-2 [--row:120px] sm:gap-3 sm:[--row:180px]"
    >
      {widths.map((aspect, index) => (
        <li
          key={index}
          className={cn('animate-pulse rounded-[2px] bg-stage-ink/10')}
          style={{
            flexGrow: aspect,
            flexBasis: `calc(${aspect} * var(--row))`,
            height: 'var(--row)',
          }}
        />
      ))}
      <li aria-hidden className="h-0" style={{ flexGrow: 1_000_000 }} />
    </ul>
  );
}
