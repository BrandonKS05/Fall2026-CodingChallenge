/**
 * The board picker shown when saving from search. Receives boards and the
 * session from the page so this component stays inside the items feature.
 */
import type { Collection, SearchResult, User } from '@wumboo/shared';
import { ImageIcon, PlusIcon } from 'lucide-react';
import { useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthDialog, type AuthMode } from '@/hooks/useAuthDialog';
import { ApiError, http } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { useSaveToBoard } from '../queries';

interface SaveToBoardDialogProps {
  result: SearchResult | null;
  user: User | null;
  boards: Collection[];
  onClose: () => void;
  onSaved: (board: Collection) => void;
  onCreateBoard: (title: string) => Promise<Collection>;
}

export function SaveToBoardDialog({
  result,
  user,
  boards,
  onClose,
  onSaved,
  onCreateBoard,
}: SaveToBoardDialogProps) {
  const save = useSaveToBoard();
  const [newTitle, setNewTitle] = useState('');
  const auth = useAuthDialog();
  const here = window.location.pathname + window.location.search;
  /** The sign-in card takes this dialog's place; the boards are here again after signing in. */
  const openAuth = (mode: AuthMode) => (event: MouseEvent<HTMLAnchorElement>) => {
    auth.intercept({ mode, from: here })(event);
    if (event.defaultPrevented) onClose();
  };
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = boards.filter((board) => board.role === 'owner' || board.role === 'editor');

  async function saveTo(board: Collection) {
    if (!result) return;
    setError(null);
    try {
      await save.mutateAsync({
        collectionId: board.id,
        body: {
          provider: result.provider,
          providerImageId: result.providerImageId,
          caption: '',
          tags: [],
        },
      });
      onSaved(board);
    } catch (caught) {
      if (ApiError.is(caught, 'CONFLICT')) {
        // Already there is as good as saved.
        onSaved(board);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not save. Please try again.');
    }
  }

  async function createAndSave(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setError(null);
    try {
      const board = await onCreateBoard(title);
      setNewTitle('');
      await saveTo(board);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the board.');
    } finally {
      setCreating(false);
    }
  }

  const busy = save.isPending || creating;

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save to a board</DialogTitle>
          <DialogDescription>
            {user
              ? 'Pick a board, or start a new one.'
              : 'Boards keep what you find. Log in to start one.'}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="flex gap-2">
            <Link
              to="/login"
              state={{ from: here }}
              onClick={openAuth('login')}
              className={buttonVariants()}
            >
              Log in
            </Link>
            <Link
              to="/register"
              state={{ from: here }}
              onClick={openAuth('register')}
              className={buttonVariants({ variant: 'outline' })}
            >
              Create an account
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {editable.length > 0 && (
              <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Your boards">
                {editable.map((board) => (
                  <li key={board.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveTo(board)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {board.previewImageIds[0] ? (
                        <img
                          src={http.url(`/images/${board.previewImageIds[0]}`)}
                          alt=""
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-md bg-muted text-muted-foreground">
                          <ImageIcon className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{board.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {pluralize(board.itemCount, 'image')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={createAndSave} className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={editable.length > 0 ? 'Or a new board…' : 'Name your first board'}
                aria-label="New board title"
                maxLength={80}
                disabled={busy}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={busy || newTitle.trim().length === 0}
              >
                <PlusIcon /> Create
              </Button>
            </form>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
