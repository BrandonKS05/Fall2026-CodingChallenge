import type { Item } from '@wumboo/shared';
import { LinkIcon, LockIcon, SearchXIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ImageLightbox } from '@/features/items/components/ImageLightbox';
import { ItemGrid } from '@/features/items/components/ItemGrid';
import { ApiError } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { useSharedBoard } from '../queries';

/** The public side of a share link: read-only, with a way in for members. */
export default function SharedBoardPage() {
  const { slug = '' } = useParams();
  const shared = useSharedBoard(slug);
  const [opened, setOpened] = useState<Item | null>(null);

  if (shared.isPending) return <PageSkeleton />;
  if (shared.error) {
    return ApiError.is(shared.error, 'FORBIDDEN') ? (
      <EmptyState
        icon={<LockIcon />}
        title="This board is private now"
        description="The owner has closed it to the public."
      />
    ) : (
      <EmptyState
        icon={<SearchXIcon />}
        title="This link is no longer valid"
        description="It may have been revoked, or the board deleted."
      />
    );
  }

  const { collection, items } = shared.data;
  const noop = () => undefined;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{collection.title}</h1>
            <Badge variant="outline" className="gap-1 font-normal">
              <LinkIcon className="size-3" /> Shared board
            </Badge>
          </div>
          {collection.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{collection.description}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {pluralize(collection.itemCount, 'image')} · by {collection.owner.displayName}
          </p>
        </div>
        {collection.role && (
          <Link to={`/boards/${collection.id}`} className={buttonVariants({ variant: 'outline' })}>
            Open in your boards
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="The owner has not saved anything to this board."
        />
      ) : (
        <ItemGrid items={items} canEdit={false} onOpen={setOpened} onEdit={noop} onRemove={noop} />
      )}
      <ImageLightbox item={opened} onClose={() => setOpened(null)} />
    </>
  );
}
