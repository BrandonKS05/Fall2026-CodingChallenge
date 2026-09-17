/**
 * A board, opened where you found it: the pictures in a carousel over the page
 * you were already on, rather than a page of their own. A visitor gets a
 * quarter of them, rounded up, and a blurred look at the next.
 */
import { LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/common/ImageLightbox';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { freeCount } from '../freeCount';
import { useBoard } from '../queries';

export function BoardCarousel({
  collectionId,
  signedIn,
  onClose,
}: {
  /** The board to open, or null when nothing is open. */
  collectionId: string | null;
  /** Whether the viewer is a member, which decides how much of the board they get. */
  signedIn: boolean;
  onClose: () => void;
}) {
  const auth = useAuthDialog();
  const board = useBoard(collectionId ?? '');
  const [index, setIndex] = useState(0);
  const items = board.data?.items ?? [];

  if (collectionId === null) return null;

  // The pictures are not here yet; say so where they will be, rather than
  // opening an empty frame that jumps when they arrive.
  if (board.isPending || items.length === 0) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          overlayClassName="bg-background/70 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md"
          className="grid place-items-center border-none bg-transparent p-10 shadow-none"
        >
          <DialogTitle className="sr-only">Opening the board</DialogTitle>
          {board.isPending ? (
            <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <p className="text-sm text-muted-foreground">
              {board.error ? board.error.message : 'This board has nothing on it yet.'}
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ImageLightbox
      items={items}
      index={index}
      onIndex={setIndex}
      onClose={() => {
        setIndex(0);
        onClose();
      }}
      free={signedIn ? undefined : freeCount(items.length)}
      onSignIn={() => auth.open({ mode: 'login' })}
      onSignUp={() => auth.open({ mode: 'register' })}
    />
  );
}
