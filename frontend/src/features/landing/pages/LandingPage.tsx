import { useState } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/features/auth';
import { BoardCarousel, useBoards, useCreateBoard } from '@/features/collections';
import { SaveToBoardDialog, type SavablePicture } from '@/features/items';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { ExploreCanvas } from '../components/ExploreCanvas';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  // A picture on the stage opens the board it is on, here, over the stage.
  const [openBoard, setOpenBoard] = useState<string | null>(null);
  const [picking, setPicking] = useState<SavablePicture | null>(null);
  const boards = useBoards(user !== null);
  const createBoard = useCreateBoard();
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
        onSave={user ? (item) => setPicking(item.image) : undefined}
      />

      <SaveToBoardDialog
        result={picking}
        user={user}
        boards={boards.data ?? []}
        onClose={() => setPicking(null)}
        onSaved={(board) => {
          setPicking(null);
          toast.success(`Saved to “${board.title}”`);
        }}
        onCreateBoard={(title) =>
          createBoard.mutateAsync({ title, description: '', visibility: 'private' })
        }
      />
    </>
  );
}
