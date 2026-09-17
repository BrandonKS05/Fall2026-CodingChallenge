/**
 * Someone's public page: who they are, and the boards this viewer has earned the
 * right to see. The server decides what "earned" means — public for anyone,
 * follower-only once you follow — so this page simply renders what it is given.
 *
 * Signed out, the whole thing is blurred behind a sign-in card: a profile is for
 * people who are part of Wumboo.
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import { StageButton } from '@/components/common/StageButton';
import { StageChrome } from '@/components/common/StageChrome';
import { useSession } from '@/features/auth';
import { BoardCard, BoardCarousel } from '@/features/collections';
import { MessagesLink, useStartConversation } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FollowButton } from '../components/FollowButton';
import { FollowListDialog } from '../components/FollowListDialog';
import { useProfile } from '../queries';

export default function ProfilePage() {
  const { handle = '' } = useParams();
  const { user } = useSession();
  const signedIn = user !== null;
  const profile = useProfile(handle);
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);
  const [openBoard, setOpenBoard] = useState<string | null>(null);

  return (
    <div className="flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome
        signedIn={signedIn}
        position="sticky"
        leading={
          <span className="stage-surface flex items-center gap-1">
            <NotificationBell user={user} />
            <MessagesLink signedIn={signedIn} />
          </span>
        }
      />

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pt-4 pb-24 sm:px-6">
        {profile.isPending ? (
          <p className="mt-16 text-center text-sm text-stage-ink/50">Looking…</p>
        ) : profile.error || !profile.data ? (
          <NotFound handle={handle} />
        ) : (
          <div className="relative">
            {/* Signed out, everything below is legible only as shapes. */}
            <div
              className={cn(
                'transition-[filter]',
                !signedIn && 'pointer-events-none blur-[5px] select-none',
              )}
              aria-hidden={!signedIn}
            >
              <header className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-16 place-items-center rounded-full bg-stage-ink text-2xl font-semibold text-stage"
                  >
                    {profile.data.profile.displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-3xl font-semibold tracking-tight">
                      {profile.data.profile.displayName}
                    </h1>
                    <p className="text-sm text-stage-ink/60">@{profile.data.profile.handle}</p>
                    {profile.data.profile.bio && (
                      <p className="mt-2 max-w-md text-sm text-stage-ink/80">
                        {profile.data.profile.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <FollowButton profile={profile.data.profile} signedIn={signedIn} />
                  {!profile.data.profile.isViewer && (
                    <MessageButton handle={profile.data.profile.handle} signedIn={signedIn} />
                  )}
                </div>
              </header>

              <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stage-ink/60">
                <span>
                  <span className="font-semibold text-stage-ink">
                    {profile.data.profile.boardCount}
                  </span>{' '}
                  {pluralize(profile.data.profile.boardCount, 'board')
                    .split(' ')
                    .slice(1)
                    .join(' ')}
                </span>
                <FollowListDialog
                  handle={handle}
                  direction="followers"
                  count={profile.data.profile.followerCount}
                  enabled={profile.data.profile.canSeeFollowList && signedIn}
                  open={openList === 'followers'}
                  onOpenChange={(open) => setOpenList(open ? 'followers' : null)}
                />
                <FollowListDialog
                  handle={handle}
                  direction="following"
                  count={profile.data.profile.followingCount}
                  enabled={profile.data.profile.canSeeFollowList && signedIn}
                  open={openList === 'following'}
                  onOpenChange={(open) => setOpenList(open ? 'following' : null)}
                />
              </p>

              <section aria-label="Boards" className="mt-8">
                {profile.data.boards.length === 0 ? (
                  <p className="text-sm text-stage-ink/50">
                    Nothing public here yet
                    {profile.data.profile.followedByViewer
                      ? '.'
                      : ' — following them may show more.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {profile.data.boards.map((board) => (
                      <BoardCard key={board.id} board={board} onOpen={setOpenBoard} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {!signedIn && <SignInGate name={profile.data.profile.displayName} />}
          </div>
        )}
      </main>

      <BoardCarousel
        collectionId={openBoard}
        signedIn={signedIn}
        onClose={() => setOpenBoard(null)}
      />
    </div>
  );
}

/** Opens the conversation with this person, wherever it needs to start. */
function MessageButton({ handle, signedIn }: { handle: string; signedIn: boolean }) {
  const start = useStartConversation();
  const auth = useAuthDialog();

  return (
    <StageButton
      variant="outline"
      disabled={start.isPending}
      onClick={() => {
        if (!signedIn) auth.open({ mode: 'login' });
        else start.mutate(handle);
      }}
    >
      Message
    </StageButton>
  );
}

function SignInGate({ name }: { name: string }) {
  const auth = useAuthDialog();
  return (
    <div className="absolute inset-0 flex items-start justify-center pt-16">
      <div className="max-w-sm border border-stage-ink/40 bg-stage/80 px-8 py-7 text-center backdrop-blur-xs">
        <p className="font-hand text-5xl leading-none">Come in first.</p>
        <p className="mt-3 text-[11px] tracking-[0.2em] text-stage-ink/70 uppercase">
          Sign in to see {name}&rsquo;s profile
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <StageButton onClick={() => auth.open({ mode: 'login' })}>Sign in</StageButton>
          <StageButton variant="outline" onClick={() => auth.open({ mode: 'register' })}>
            Create an account
          </StageButton>
        </div>
      </div>
    </div>
  );
}

function NotFound({ handle }: { handle: string }) {
  return (
    <div className="mt-16 text-center">
      <p className="font-hand text-5xl leading-none">Nobody here.</p>
      <p className="mt-3 text-sm text-stage-ink/60">No account goes by @{handle}.</p>
    </div>
  );
}
