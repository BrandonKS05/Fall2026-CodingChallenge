/**
 * The person's own page on the stage: a profile strip, then Pins (everything
 * they saved, in justified rows) or Boards (covers, plus a Create card that is
 * always there, so the very first board starts from the same place).
 */
import type { Collection, SavedItem } from '@wumboo/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { JustifiedRows, JustifiedRowsSkeleton } from '@/components/common/JustifiedRows';
import { StageButton } from '@/components/common/StageButton';
import { StageChrome } from '@/components/common/StageChrome';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout, useSession } from '@/features/auth';
import { useMyItems } from '@/features/items';
import { http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BoardCard } from '../components/BoardCard';
import { BoardCarousel } from '../components/BoardCarousel';
import { CreateBoardDialog } from '../components/CreateBoardDialog';
import { useBoards } from '../queries';

type Tab = 'pins' | 'boards';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pins', label: 'Pins' },
  { id: 'boards', label: 'Boards' },
];

export default function BoardsPage() {
  const { user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const boards = useBoards();
  const pins = useMyItems();
  const [tab, setTab] = useState<Tab>('boards');
  const [creating, setCreating] = useState(false);
  // A board opens here, over your own wall, as it does everywhere else.
  const [openBoard, setOpenBoard] = useState<string | null>(null);

  // Boards you own, and the likes they have gathered: the two numbers under the name.
  const owned = (boards.data ?? []).filter((board) => board.role === 'owner');
  const likes = owned.reduce((sum, board) => sum + board.likeCount, 0);
  const name = user?.displayName ?? '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

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

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pt-4 pb-24 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your finds</h1>
          <div className="flex items-center gap-4">
            {/* The name and avatar open the account menu; that is where logging out lives. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex items-center gap-4 rounded-2xl p-1 text-left transition-colors hover:bg-stage-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stage-ink"
                  />
                }
              >
                <span
                  aria-hidden
                  className="grid size-14 place-items-center rounded-full bg-stage-ink text-xl font-semibold text-stage"
                >
                  {initial}
                </span>
                <span className="pr-2">
                  <span className="block font-semibold">{name}</span>
                  <span className="block text-sm text-stage-ink/50">@{user?.handle}</span>
                  <span className="block text-sm text-stage-ink/60">
                    {pluralize(owned.length, 'board')} · {pluralize(likes, 'like')}
                  </span>
                  {user?.bio && (
                    <span className="mt-1 block max-w-xs text-sm text-stage-ink/80">
                      {user.bio}
                    </span>
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Currently in
                  </DropdownMenuLabel>
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <span
                      aria-hidden
                      className="grid size-9 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
                    >
                      {initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </span>
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void navigate('/settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    // Leave the protected page first so the route guard has nothing to redirect.
                    void navigate('/');
                    logout.mutate();
                  }}
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <StageButton onClick={() => setCreating(true)}>Create</StageButton>
          </div>
        </header>

        <div className="mt-8 border-b border-stage-ink/20">
          <div role="tablist" aria-label="Your finds" className="flex gap-6 text-sm font-medium">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={tab === entry.id}
                aria-controls={`panel-${entry.id}`}
                onClick={() => setTab(entry.id)}
                className={cn(
                  '-mb-px border-b-2 px-1 pb-3 transition-colors',
                  tab === entry.id
                    ? 'border-stage-ink text-stage-ink'
                    : 'border-transparent text-stage-ink/60 hover:text-stage-ink',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <section
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="mt-6"
        >
          {tab === 'boards' ? (
            <BoardsTab
              boards={boards.data ?? []}
              pending={boards.isPending}
              onCreate={() => setCreating(true)}
              onOpen={setOpenBoard}
            />
          ) : (
            <PinsTab pins={pins.data ?? []} pending={pins.isPending} />
          )}
        </section>
      </main>

      <BoardCarousel
        collectionId={openBoard}
        signedIn={user !== null}
        onClose={() => setOpenBoard(null)}
      />
      <CreateBoardDialog open={creating} onOpenChange={setCreating} withTrigger={false} />
    </div>
  );
}

const GRID = 'grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

function BoardsTab({
  boards,
  pending,
  onCreate,
  onOpen,
}: {
  boards: Collection[];
  pending: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  if (pending) {
    return (
      <div className={GRID} aria-busy aria-label="Loading boards">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stage-ink/10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-stage-ink/10" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={GRID}>
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} onOpen={onOpen} />
      ))}
      <CreateCard onClick={onCreate} />
    </div>
  );
}

/** The empty frame that is always there: three panes like a cover, and a Create pill in the middle. */
function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create a board"
      className="group block text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stage-ink"
    >
      <span className="relative grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-stage-ink/10 transition-colors group-hover:bg-stage-ink/15">
        <span className="col-span-2 row-span-2 bg-stage-ink/15" />
        <span className="bg-stage-ink/15" />
        <span className="bg-stage-ink/15" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="rounded-2xl bg-stage-ink px-5 py-3 font-semibold text-stage shadow-lg">
            Create
          </span>
        </span>
      </span>
      <span className="mt-2 block px-1 text-lg leading-tight font-semibold text-stage-ink/60 group-hover:text-stage-ink">
        New board
      </span>
    </button>
  );
}

function PinsTab({ pins, pending }: { pins: SavedItem[]; pending: boolean }) {
  if (pending) return <JustifiedRowsSkeleton label="Loading your pins" />;
  if (pins.length === 0) {
    return (
      <p className="mt-16 text-center text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
        Nothing saved yet.{' '}
        <Link to="/discover" className="underline underline-offset-4 hover:text-stage-ink">
          Find something on Discover
        </Link>
      </p>
    );
  }
  return (
    <JustifiedRows
      label="Your pins"
      tiles={pins.map((pin) => ({
        id: pin.id,
        src: http.url(`/images/${pin.image.id}`),
        aspect: pin.image.width / pin.image.height,
        href: `/boards/${pin.collectionId}`,
        label: `Open ${pin.collection.title}`,
      }))}
    />
  );
}
