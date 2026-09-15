import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { BoardGrid, BoardGridSkeleton } from '../components/BoardGrid';
import { CreateBoardDialog } from '../components/CreateBoardDialog';
import { useBoards } from '../queries';

export default function BoardsPage() {
  const boards = useBoards();
  const [creating, setCreating] = useState(false);
  const openCreator = () => setCreating(true);

  return (
    <>
      <PageHeader
        title="My boards"
        description="Everything you have saved, organized your way."
        actions={
          <Button onClick={openCreator}>
            <PlusIcon /> New board
          </Button>
        }
      />
      {boards.isPending ? (
        <BoardGridSkeleton />
      ) : (
        // Blank cards stand in for the empty state: the grid is always ready to be filled.
        <BoardGrid boards={boards.data ?? []} onCreate={openCreator} />
      )}
      <CreateBoardDialog open={creating} onOpenChange={setCreating} withTrigger={false} />
    </>
  );
}
