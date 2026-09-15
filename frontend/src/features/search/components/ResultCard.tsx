import type { SearchResult } from '@wumboo/shared';
import { BookmarkIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResultCardProps {
  result: SearchResult;
  /** Title of the board this image was saved to during this visit, if any. */
  savedTo?: string | undefined;
  onSave: (result: SearchResult) => void;
}

/**
 * A search hit. The tiny preview is stretched and blurred underneath while
 * the 640px image loads, so the grid fills with color immediately.
 */
export function ResultCard({ result, savedTo, onSave }: ResultCardProps) {
  const [loaded, setLoaded] = useState(false);
  const alt = result.tags.slice(0, 3).join(', ') || 'Image';

  return (
    <figure
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-muted"
      style={{ aspectRatio: `${result.width} / ${result.height}` }}
    >
      <img
        src={result.previewUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg"
      />
      <img
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) setLoaded(true);
        }}
        src={result.displayUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          'relative h-full w-full object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className={cn(
          'absolute inset-x-0 top-0 flex justify-end p-2 transition-opacity',
          savedTo
            ? 'opacity-100'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        {savedTo ? (
          <Button size="sm" variant="secondary" disabled aria-label={`Saved to ${savedTo}`}>
            <CheckIcon /> Saved
          </Button>
        ) : (
          <Button size="sm" onClick={() => onSave(result)} aria-label={`Save ${alt}`}>
            <BookmarkIcon /> Save
          </Button>
        )}
      </div>

      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2 text-xs text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
          {result.credit.name} · Pixabay
        </a>
      </figcaption>
    </figure>
  );
}
