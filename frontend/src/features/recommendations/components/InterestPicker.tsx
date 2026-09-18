/**
 * Cold start, asked rather than guessed.
 *
 * A new account has nothing for the feed to work from, and waiting for it to
 * save enough pictures is a poor first week. Ticking a few categories seeds a
 * couple of starting interests — the server clusters them, so picking five
 * does not spend five of the eight interests anybody is allowed.
 */
import { SEARCH_CATEGORIES, type SearchCategory } from '@wumboo/shared';
import { useState } from 'react';
import { StageButton } from '@/components/common/StageButton';
import { cn } from '@/lib/utils';
import { useChooseInterests } from '../queries';

/** Enough to cluster into more than one interest without being a form. */
const MINIMUM = 3;

export function InterestPicker({ className }: { className?: string }) {
  const [picked, setPicked] = useState<SearchCategory[]>([]);
  const choose = useChooseInterests();

  const toggle = (category: SearchCategory) =>
    setPicked((current) =>
      current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    );

  return (
    <section aria-label="Pick what you like" className={cn('text-stage-ink', className)}>
      <h2 className="font-heading text-lg font-medium">Tell us what you like</h2>
      <p className="mt-1 text-sm text-stage-ink/60">
        Pick a few and the feed has somewhere to start. Saving pictures will do the rest.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {SEARCH_CATEGORIES.map((category) => {
          const on = picked.includes(category);
          return (
            <li key={category}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(category)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm capitalize transition-colors',
                  on
                    ? 'border-stage-ink bg-stage-ink text-stage'
                    : 'border-stage-ink/25 text-stage-ink/80 hover:border-stage-ink/60',
                )}
              >
                {category}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <StageButton
          disabled={picked.length < MINIMUM || choose.isPending}
          onClick={() => choose.mutate(picked)}
        >
          {choose.isPending ? 'Setting up…' : 'Start my feed'}
        </StageButton>
        <span className="text-xs text-stage-ink/50">
          {picked.length < MINIMUM
            ? `Pick ${MINIMUM - picked.length} more`
            : `${picked.length} picked`}
        </span>
      </div>
    </section>
  );
}
