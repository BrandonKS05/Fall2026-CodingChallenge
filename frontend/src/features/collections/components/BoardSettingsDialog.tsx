import type { Collection } from '@trove/shared';
import { SettingsIcon } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useDeleteBoard, useUpdateBoard } from '../queries';
import { BoardForm } from './BoardForm';

export function BoardSettingsDialog({ board }: { board: Collection }) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const navigate = useNavigate();
  const update = useUpdateBoard(board.id);
  const remove = useDeleteBoard();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmingDelete(false);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <SettingsIcon /> Settings
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board settings</DialogTitle>
          <DialogDescription>Rename it, describe it, or change who can see it.</DialogDescription>
        </DialogHeader>
        <BoardForm
          defaultValues={{
            title: board.title,
            description: board.description,
            visibility: board.visibility,
          }}
          submitLabel="Save changes"
          pending={update.isPending}
          onSubmit={async (values) => {
            await update.mutateAsync(values);
            setOpen(false);
            toast.success('Board updated');
          }}
        />
        <Separator />
        <div className="space-y-2">
          <p className="text-sm font-medium">Delete this board</p>
          <p className="text-xs text-muted-foreground">
            Removes the board and everything saved to it. Images stay available on your other
            boards.
          </p>
          {confirmingDelete ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(board.id, {
                    onSuccess: () => {
                      toast.success(`Deleted “${board.title}”`);
                      navigate('/boards', { replace: true });
                    },
                  })
                }
              >
                {remove.isPending ? 'Deleting…' : 'Yes, delete it'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Keep it
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
              Delete board
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
