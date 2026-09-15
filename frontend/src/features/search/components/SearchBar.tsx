import { searchColorSchema, type SearchQuery } from '@wumboo/shared';
import { SearchIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

export type Orientation = SearchQuery['orientation'];
export type SearchColor = NonNullable<SearchQuery['color']>;

const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: 'all', label: 'Any shape' },
  { value: 'horizontal', label: 'Landscape' },
  { value: 'vertical', label: 'Portrait' },
];

/** Swatches for Pixabay's color filter. "transparent" is skipped; it makes no sense for photos. */
const SWATCHES: Record<Exclude<SearchColor, 'transparent'>, string> = {
  grayscale: 'linear-gradient(135deg, #fafafa, #262626)',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  turquoise: '#14b8a6',
  blue: '#3b82f6',
  lilac: '#a78bfa',
  pink: '#ec4899',
  white: '#f8fafc',
  gray: '#9ca3af',
  black: '#171717',
  brown: '#92400e',
};

export interface SearchFilters {
  q: string;
  orientation: Orientation;
  color?: SearchColor;
}

interface SearchBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  autoFocus?: boolean;
}

export function SearchBar({ filters, onChange, autoFocus }: SearchBarProps) {
  const [text, setText] = useState(filters.q);
  const debounced = useDebouncedValue(text, 300);
  // Back/forward navigation or a suggestion chip changes the URL; mirror it into the box.
  // Adjusting state while rendering (not in an effect) is React's documented way to reset on a prop change.
  const [mirroredQuery, setMirroredQuery] = useState(filters.q);
  if (filters.q !== mirroredQuery) {
    setMirroredQuery(filters.q);
    setText(filters.q);
  }

  // Typing updates the URL after a pause; the URL is the source of truth for the query.
  useEffect(() => {
    if (debounced !== filters.q) onChange({ ...filters, q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="space-y-3">
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ ...filters, q: text });
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Try “warm kitchen”, “fog over pines”, “brutalist library”"
          className="h-11 pr-10 pl-9 text-base"
          aria-label="Search images"
          autoFocus={autoFocus}
          enterKeyHint="search"
        />
        {text && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
            aria-label="Clear search"
            onClick={() => {
              setText('');
              onChange({ ...filters, q: '' });
            }}
          >
            <XIcon />
          </Button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="radiogroup" aria-label="Orientation" className="flex rounded-md border p-0.5">
          {ORIENTATIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={filters.orientation === option.value}
              onClick={() => onChange({ ...filters, orientation: option.value })}
              className={cn(
                'rounded px-2.5 py-1 text-xs transition-colors',
                filters.orientation === option.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Color" className="flex items-center gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={filters.color === undefined}
            aria-label="Any color"
            onClick={() => onChange({ ...filters, color: undefined })}
            className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              filters.color === undefined
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Any color
          </button>
          {searchColorSchema.options
            .filter(
              (color): color is Exclude<SearchColor, 'transparent'> => color !== 'transparent',
            )
            .map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={filters.color === color}
                aria-label={color}
                title={color}
                onClick={() => onChange({ ...filters, color })}
                style={{ background: SWATCHES[color] }}
                className={cn(
                  'size-5 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/20',
                  filters.color === color &&
                    'ring-2 ring-foreground ring-offset-2 ring-offset-background',
                )}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
