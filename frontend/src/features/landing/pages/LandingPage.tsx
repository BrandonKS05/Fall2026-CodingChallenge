import { useState } from 'react';
import { useSession } from '@/features/auth';
import { BoardCarousel } from '@/features/collections';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { ExploreCanvas } from '../components/ExploreCanvas';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  // A picture on the stage opens the board it is on, here, over the stage.
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const auth = useAuthDialog();
  // Both of the things that can sit over the stage. While either is up the map
  // holds still: reading a card over a drifting background is a horrible way to
  // spend a moment.
  const covered = openBoard !== null || auth.request !== null;

  return (
    <>
      <ExploreCanvas
        signedIn={user !== null}
        onOpenBoard={setOpenBoard}
        paused={covered}
        chromeLeading={
          <span className="stage-surface flex items-center gap-1">
            <NotificationBell user={user} />
            <MessagesLink signedIn={user !== null} />
          </span>
        }
      />
      <BoardCarousel
        collectionId={openBoard}
        signedIn={user !== null}
        onClose={() => setOpenBoard(null)}
      />
    </>
  );
}
