import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { SearchFilters } from '../filters';

/**
 * The query, and only the query — every other option lives in the filter panel
 * beside it. Typing settles for a moment before it reaches the URL, so a
 * sentence typed quickly is one search rather than a dozen.
 */
export function SearchBar({
  filters,
  onChange,
  autoFocus,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(filters.q);
  const debounced = useDebouncedValue(text, 300);
  // Back/forward navigation or a suggestion chip changes the URL; mirror it into the box.
  // Adjusting state while rendering (not in an effect) is React's documented way to reset on a prop change.
  const [mirroredQuery, setMirroredQuery] = useState(filters.q);
  if (filters.q !== mirroredQuery) {
    setMirroredQuery(filters.q);
    setText(filters.q);
  }

  useEffect(() => {
    if (debounced !== filters.q) onChange({ ...filters, q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...filters, q: text });
      }}
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search millions of free photos"
        aria-label="Search for images"
        autoFocus={autoFocus}
        autoComplete="off"
        className="h-11 pl-9"
      />
    </form>
  );
}
