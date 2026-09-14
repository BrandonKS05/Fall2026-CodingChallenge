import { LayoutGridIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { BoardGrid, BoardGridSkeleton } from '../components/BoardGrid';
import { CreateBoardDialog } from '../components/CreateBoardDialog';
import { useBoards } from '../queries';

export default function BoardsPage() {
  const boards = useBoards();

  return (
    <>
      <PageHeader
        title="My boards"
        description="Everything you have saved, organized your way."
        actions={<CreateBoardDialog />}
      />
      {boards.isPending ? (
        <BoardGridSkeleton />
      ) : boards.data && boards.data.length > 0 ? (
        <BoardGrid boards={boards.data} />
      ) : (
        <EmptyState
          icon={<LayoutGridIcon />}
          title="No boards yet"
          description="Create a board, then save images into it from Discover."
          action={<CreateBoardDialog />}
        />
      )}
    </>
  );
}
