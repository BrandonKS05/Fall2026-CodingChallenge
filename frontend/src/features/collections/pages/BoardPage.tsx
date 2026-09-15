import type { Item } from '@wumboo/shared';
import { ImagePlusIcon, LockIcon, SearchXIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { ApiError } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { BoardSettingsDialog } from '../components/BoardSettingsDialog';
import { VisibilityBadge } from '../components/VisibilityBadge';
import { useBoard, useBoards } from '../queries';
import { useSession } from '@/features/auth';
import {
  EditItemDialog,
  ImageLightbox,
  ItemGrid,
  ItemGridSkeleton,
  useAddItem,
  useRemoveItem,
} from '@/features/items';
import { SharePanel } from '@/features/sharing';

export default function BoardPage() {
  const { id = '' } = useParams();
  const board = useBoard(id);
  const { user } = useSession();
  const auth = useAuthDialog();
  // Only needed for "move to"; fetched lazily by the query cache, cheap when already loaded.
  const myBoards = useBoards(user !== null);
  const addItem = useAddItem(id);
  const removeItem = useRemoveItem(id);
  const [opened, setOpened] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);

  if (board.isPending) return <PageSkeleton />;

  if (board.error) {
    if (ApiError.is(board.error, 'FORBIDDEN')) {
      return (
        <EmptyState
          icon={<LockIcon />}
          title="This board is private"
          description={
            user ? 'Ask the owner to add you as a member.' : 'Log in if you have been added to it.'
          }
          action={
            !user && (
              <Link
                to="/login"
                state={{ from: `/boards/${id}` }}
                onClick={auth.intercept({ mode: 'login', from: `/boards/${id}` })}
                className={buttonVariants()}
              >
                Log in
              </Link>
            )
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title="Board not found"
        description="It may have been deleted."
      />
    );
  }

  const { collection, items } = board.data;
  const canEdit = collection.role === 'owner' || collection.role === 'editor';
  const destinations = (myBoards.data ?? []).filter(
    (candidate) =>
      candidate.id !== collection.id && (candidate.role === 'owner' || candidate.role === 'editor'),
  );

  function remove(item: Item) {
    removeItem.mutate(item.id, {
      onSuccess: () =>
        toast('Removed from board', {
          action: {
            label: 'Undo',
            onClick: () =>
              addItem.mutate({
                provider: item.image.provider,
                providerImageId: item.image.providerImageId,
                caption: item.caption,
                tags: item.tags,
              }),
          },
        }),
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{collection.title}</h1>
          {collection.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{collection.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{pluralize(collection.itemCount, 'image')}</span>
            <VisibilityBadge visibility={collection.visibility} />
            <span>by {collection.owner.displayName}</span>
            {collection.role && collection.role !== 'owner' && (
              <Badge variant="secondary" className="font-normal capitalize">
                {collection.role}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              to={`/discover?board=${collection.id}`}
              className={buttonVariants({ variant: 'outline' })}
            >
              <ImagePlusIcon /> Add images
            </Link>
          )}
          {user && collection.role && <SharePanel board={collection} currentUserId={user.id} />}
          {collection.role === 'owner' && <BoardSettingsDialog board={collection} />}
        </div>
      </div>

      {board.isFetching && items.length === 0 ? (
        <ItemGridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImagePlusIcon />}
          title="Nothing saved here yet"
          description={
            canEdit
              ? 'Search for images and save them to this board.'
              : 'The board is empty for now.'
          }
          action={
            canEdit && (
              <Link to={`/discover?board=${collection.id}`} className={buttonVariants()}>
                Find images
              </Link>
            )
          }
        />
      ) : (
        <ItemGrid
          items={items}
          canEdit={canEdit}
          onOpen={setOpened}
          onEdit={setEditing}
          onRemove={remove}
        />
      )}

      <ImageLightbox item={opened} onClose={() => setOpened(null)} />
      <EditItemDialog
        collectionId={collection.id}
        item={editing}
        destinations={destinations}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
