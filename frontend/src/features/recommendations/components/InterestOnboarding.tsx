/**
 * The one thing a new account is asked, once, before it is let loose.
 *
 * It exists because the feed has nothing to go on at the start and waiting for
 * somebody to save enough pictures is a poor first week. It is deliberately
 * skippable: a person who does not want to answer gets a feed of what other
 * people like instead, which is a fine place to begin.
 *
 * Whether they picked or skipped, the server stamps the step as done, so this
 * is never the second thing anybody sees. Whether it is owed at all is the
 * app's call, not this component's: it only knows how to ask.
 */
import { MAX_STARTING_INTERESTS, SEARCH_CATEGORIES, type SearchCategory } from '@wumboo/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useChooseInterests } from '../queries';

export function InterestOnboarding() {
  const [picked, setPicked] = useState<SearchCategory[]>([]);
  const choose = useChooseInterests();

  const full = picked.length >= MAX_STARTING_INTERESTS;
  const toggle = (category: SearchCategory) =>
    setPicked((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : current.length >= MAX_STARTING_INTERESTS
          ? current
          : [...current, category],
    );

  return (
    // No close button and no dismissing by clicking away: answering it, even
    // by skipping, is what gets past it.
    <Dialog open>
      <DialogContent
        // No close button: skipping is the way out, and it is one click away.
        // A dismissed dialog would leave the step unanswered and bring it back
        // on the next visit, which is exactly what this replaced.
        showCloseButton={false}
        className="max-h-[92svh] w-[min(100vw-2rem,36rem)] max-w-none overflow-y-auto sm:max-w-none"
        overlayClassName="bg-background/80 backdrop-blur-sm"
      >
        <DialogTitle className="font-hand text-4xl leading-none">What are you into?</DialogTitle>
        <DialogDescription>
          Pick up to {MAX_STARTING_INTERESTS} and your feed starts somewhere close. You can skip
          this — saving pictures teaches it either way.
        </DialogDescription>

        <ul className="flex flex-wrap gap-2">
          {SEARCH_CATEGORIES.map((category) => {
            const on = picked.includes(category);
            return (
              <li key={category}>
                <button
                  type="button"
                  aria-pressed={on}
                  // Not disabled: a full list should still let you change your mind
                  // about one of them, so only the unpicked ones stop responding.
                  disabled={full && !on}
                  onClick={() => toggle(category)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm capitalize transition-colors',
                    on
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-foreground/80 hover:border-foreground/60',
                    full && !on && 'opacity-40',
                  )}
                >
                  {category}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={choose.isPending} onClick={() => choose.mutate([])}>
            Skip for now
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {picked.length} of {MAX_STARTING_INTERESTS}
            </span>
            <Button
              disabled={picked.length === 0 || choose.isPending}
              onClick={() => choose.mutate(picked)}
            >
              {choose.isPending ? 'Setting up…' : 'Start my feed'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
