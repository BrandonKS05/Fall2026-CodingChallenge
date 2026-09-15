import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateBoard } from '../queries';
import { BoardForm } from './BoardForm';

interface CreateBoardDialogProps {
  /** Controlled open state, for pages that open the creator from several places. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in "New board" button when the page provides its own triggers. */
  withTrigger?: boolean;
}

export function CreateBoardDialog({
  open,
  onOpenChange,
  withTrigger = true,
}: CreateBoardDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const navigate = useNavigate();
  const create = useCreateBoard();

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {withTrigger && (
        <DialogTrigger render={<Button />}>
          <PlusIcon /> New board
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>A place for the things that belong together.</DialogDescription>
        </DialogHeader>
        <BoardForm
          submitLabel="Create board"
          pending={create.isPending}
          onSubmit={async (values) => {
            const board = await create.mutateAsync(values);
            setOpen(false);
            toast.success(`Created “${board.title}”`);
            void navigate(`/boards/${board.id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
