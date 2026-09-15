import type { Collection } from '@wumboo/shared';
import { HeartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { cn } from '@/lib/utils';
import { useLikeBoard } from '../queries';

/** Heart plus count. Visitors get the sign-in card; owners see the count but cannot like their own. */
export function LikeButton({ board, signedIn }: { board: Collection; signedIn: boolean }) {
  const like = useLikeBoard(board.id);
  const auth = useAuthDialog();
  const own = board.role === 'owner';
  const label = board.likedByViewer ? 'Unlike this board' : 'Like this board';

  return (
    <Button
      variant="outline"
      aria-label={own ? `${board.likeCount} likes` : label}
      aria-pressed={own ? undefined : board.likedByViewer}
      disabled={own || like.isPending}
      title={own ? 'People who like your board' : undefined}
      onClick={() => {
        if (!signedIn) auth.open({ mode: 'login' });
        else like.mutate(!board.likedByViewer);
      }}
    >
      <HeartIcon className={cn('size-4', board.likedByViewer && 'fill-current')} />
      {board.likeCount}
    </Button>
  );
}
