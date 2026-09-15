import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteAccount } from '../../queries';
import { Card, Panel } from './Panel';

export function AccountManagementSection() {
  const [open, setOpen] = useState(false);
  const remove = useDeleteAccount();
  const navigate = useNavigate();

  return (
    <Panel
      title="Account management"
      description="The end of the line. Everything here is permanent."
    >
      <Card>
        <h3 className="text-sm font-medium">Delete your account</h3>
        <p className="mt-1 text-sm text-stage-ink/55">
          Your boards, everything you saved, the likes you left, and your notifications go at the
          same time. Images other people saved to their own boards stay with them. There is no undo,
          so take a copy from Privacy first if you want one.
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your boards, saves, likes, and notifications go with it, right away and for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync();
                setOpen(false);
                toast.success('Your account is gone. Take care.');
                void navigate('/', { replace: true });
              }}
            >
              {remove.isPending ? 'Deleting\u2026' : 'Delete for good'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
