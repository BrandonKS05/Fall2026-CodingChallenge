import { useState } from 'react';
import { useSession } from '@/features/auth';
import { BoardCarousel } from '@/features/collections';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { ExploreCanvas } from '../components/ExploreCanvas';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  // A picture on the stage opens the board it is on, here, over the stage.
  const [openBoard, setOpenBoard] = useState<string | null>(null);

  return (
    <>
      <ExploreCanvas
        signedIn={user !== null}
        onOpenBoard={setOpenBoard}
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
