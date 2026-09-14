import { CompassIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { BoardGrid, BoardGridSkeleton } from '../components/BoardGrid';
import { useExplore } from '../queries';

export default function ExplorePage() {
  const boards = useExplore();

  return (
    <>
      <PageHeader title="Explore" description="Public boards from everyone on Trove, newest first." />
      {boards.isPending ? (
        <BoardGridSkeleton />
      ) : boards.data && boards.data.length > 0 ? (
        <BoardGrid boards={boards.data} />
      ) : (
        <EmptyState
          icon={<CompassIcon />}
          title="Nothing public yet"
          description="Make one of your boards public and it will show up here."
        />
      )}
    </>
  );
}
