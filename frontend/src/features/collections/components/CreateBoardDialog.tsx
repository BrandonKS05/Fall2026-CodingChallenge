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

export function CreateBoardDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const create = useCreateBoard();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon /> New board
      </DialogTrigger>
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
            navigate(`/boards/${board.id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
