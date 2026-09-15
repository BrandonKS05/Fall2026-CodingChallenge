/**
 * Justified rows of pictures, the way a studio's "all work" page or a contact
 * sheet is laid out: every tile keeps its aspect ratio at a fixed row height and
 * grows in proportion to its width, so each row fills the line edge to edge.
 * The trailing spacer stops the last row from stretching.
 */
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export interface JustifiedTile {
  id: string;
  src: string;
  /** width / height of the picture. */
  aspect: number;
  /** Where the tile goes; omitted tiles are inert. */
  href?: string;
  /** Accessible name of the link, and the hover caption. */
  label: string;
}

const ROWS = 'flex flex-wrap gap-2 [--row:120px] sm:gap-3 sm:[--row:180px]';

function tileStyle(aspect: number) {
  return { flexGrow: aspect, flexBasis: `calc(${aspect} * var(--row))`, height: 'var(--row)' };
}

interface JustifiedRowsProps {
  tiles: JustifiedTile[];
  /** Accessible name of the list. Omit for a decorative (blurred, inert) block. */
  label?: string;
  blurred?: boolean;
  className?: string;
}

export function JustifiedRows({ tiles, label, blurred = false, className }: JustifiedRowsProps) {
  return (
    <ul
      aria-label={label}
      aria-hidden={blurred || undefined}
      className={cn(ROWS, blurred && 'blur-md select-none', className)}
    >
      {tiles.map((tile) => {
        const picture = (
          <img
            src={tile.src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full rounded-[2px] object-cover"
          />
        );
        return (
          <li key={tile.id} className="group relative" style={tileStyle(tile.aspect)}>
            {tile.href && !blurred ? (
              <Link to={tile.href} aria-label={tile.label} className="block h-full w-full">
                {picture}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-stage/80 to-transparent px-2 pt-6 pb-1.5 text-[10px] tracking-[0.2em] text-stage-ink uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {tile.label}
                </span>
              </Link>
            ) : (
              picture
            )}
          </li>
        );
      })}
      <li aria-hidden className="h-0" style={{ flexGrow: 1_000_000 }} />
    </ul>
  );
}

export function JustifiedRowsSkeleton({ label, className }: { label: string; className?: string }) {
  const widths = [1.5, 1, 0.8, 1.78, 1.2, 0.75, 1.5, 1, 1.33, 0.9, 1.6, 1.1];
  return (
    <ul aria-busy aria-label={label} className={cn(ROWS, className)}>
      {widths.map((aspect, index) => (
        <li
          key={index}
          className="animate-pulse rounded-[2px] bg-stage-ink/10"
          style={tileStyle(aspect)}
        />
      ))}
      <li aria-hidden className="h-0" style={{ flexGrow: 1_000_000 }} />
    </ul>
  );
}
