import type { ProfileSummary } from '@wumboo/shared';
import { PenSquareIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStartConversation } from '../queries';

/**
 * Starting a conversation is picking a person, so the list is the people you
 * follow. Picking one opens the conversation you already have with them, or
 * makes the one you do not.
 */
export function NewMessageDialog({
  people,
  loading,
}: {
  people: ProfileSummary[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const start = useStartConversation();

  const needle = filter.trim().toLowerCase();
  const matches = needle
    ? people.filter(
        (person) =>
          person.displayName.toLowerCase().includes(needle) ||
          person.handle.toLowerCase().includes(needle),
      )
    : people;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFilter('');
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="icon" aria-label="New message" />}>
        <PenSquareIcon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Anyone you follow. Pick a person to open the chat.</DialogDescription>
        </DialogHeader>

        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search the people you follow"
          aria-label="Search the people you follow"
          autoComplete="off"
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Looking…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {people.length === 0
              ? 'You are not following anyone yet. Open someone’s profile to follow them, or message them from there.'
              : 'Nobody by that name.'}
          </p>
        ) : (
          <ul aria-label="People you follow" className="max-h-72 overflow-y-auto">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={start.isPending}
                  onClick={() => start.mutate(person.handle, { onSuccess: () => setOpen(false) })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background"
                  >
                    {person.displayName.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{person.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{person.handle}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
