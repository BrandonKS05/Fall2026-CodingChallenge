/**
 * Landing hero: public boards scattered across a dark stage that drifts
 * against the cursor. Images sit at fixed slots on a stage 40% larger than
 * the viewport; each slot has a depth, so near images travel further.
 */
import type { Collection } from '@wumboo/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { http, queryKeys } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DEFAULT_TUNING,
  useLayerOffset,
  useMediaQuery,
  useParallax,
  type Parallax,
  type ParallaxTuning,
} from './useParallax';

const TILE_LIMIT = 12;
/** Custom cursor dot, in px, and how much it grows over an image. */
const DOT_SIZE = 12;
const DOT_HOVER_SCALE = 1.6;

interface Slot {
  /** Position in percent of the enlarged stage (0 to 100 maps to -20vw..120vw). */
  x: number;
  y: number;
  /** Width in vw. */
  width: number;
  /** 0.3 (far, barely moves) to 1 (near, full travel). */
  depth: number;
}

/** Twelve fixed slots, spread so the viewport is busy at the edges and calm in the middle. */
const SLOTS: Slot[] = [
  { x: 36, y: 34, width: 30, depth: 1 },
  { x: 62, y: 5, width: 26, depth: 0.7 },
  { x: 6, y: 4, width: 22, depth: 0.5 },
  { x: 48, y: 74, width: 28, depth: 0.45 },
  { x: 80, y: 42, width: 20, depth: 0.6 },
  { x: 14, y: 66, width: 24, depth: 0.8 },
  { x: 1, y: 38, width: 18, depth: 0.35 },
  { x: 78, y: 78, width: 19, depth: 0.9 },
  { x: 30, y: 6, width: 18, depth: 0.3 },
  { x: 88, y: 14, width: 18, depth: 0.4 },
  { x: 4, y: 88, width: 20, depth: 0.55 },
  { x: 64, y: 54, width: 18, depth: 0.65 },
];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Tile {
  key: string;
  collectionId: string;
  title: string;
  src: string;
  slot: Slot;
}

/** Covers first, then second images, and so on, so every board shows before any repeats. */
function toTiles(collections: Collection[]): Tile[] {
  const tiles: Tile[] = [];
  for (let round = 0; tiles.length < TILE_LIMIT; round += 1) {
    let added = false;
    for (const collection of collections) {
      const imageId = collection.previewImageIds[round];
      const slot = SLOTS[tiles.length];
      if (!imageId || !slot) continue;
      tiles.push({
        key: `${collection.id}:${imageId}`,
        collectionId: collection.id,
        title: collection.title,
        src: http.url(`/images/${imageId}`),
        slot,
      });
      added = true;
      if (tiles.length >= TILE_LIMIT) break;
    }
    if (!added) break;
  }
  return tiles;
}

export interface ExploreCanvasProps {
  /** Swaps the "Sign in" link for "Discover" once there is a session. */
  signedIn?: boolean;
  tuning?: ParallaxTuning;
}

export function ExploreCanvas({ signedIn = false, tuning = DEFAULT_TUNING }: ExploreCanvasProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const interactive = !reducedMotion && !coarsePointer;
  const parallax = useParallax(interactive, tuning);
  const [hovering, setHovering] = useState(false);

  // Existing endpoint through the existing client; a failure simply leaves the stage empty.
  const boards = useQuery({
    queryKey: queryKeys.collections.explore({ page: 1, perPage: TILE_LIMIT }),
    queryFn: () =>
      http
        .get<{ collections: Collection[] }>('/explore', { query: { page: 1, perPage: TILE_LIMIT } })
        .then((response) => response.collections),
    retry: false,
    meta: { silentError: true },
  });
  // A tile whose image fails to load (gone upstream, storage outage) gives up its
  // slot rather than showing a broken picture; the other tiles keep their places.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const tiles = boards.data ? toTiles(boards.data).filter((tile) => !failed.has(tile.key)) : [];

  return (
    <section
      aria-label="Featured boards"
      className={cn(
        'relative h-svh w-full overflow-hidden bg-stage text-stage-ink select-none',
        interactive && 'cursor-none',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{ backgroundImage: NOISE }}
      />

      <div className="absolute inset-[-20%]">
        {tiles.map((tile) => (
          <StageTile
            key={tile.key}
            tile={tile}
            parallax={parallax}
            interactive={interactive}
            onHover={setHovering}
            onError={() => setFailed((previous) => new Set(previous).add(tile.key))}
          />
        ))}
      </div>

      <header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="text-2xl leading-none font-bold tracking-tighter uppercase [font-stretch:condensed]"
        >
          Wumboo
        </Link>
        <nav
          aria-label="Landing"
          className="flex items-center gap-3 text-[11px] tracking-[0.2em] uppercase"
        >
          <Link to="/explore" className="transition-opacity hover:opacity-70">
            Explore
          </Link>
          <span aria-hidden>·</span>
          <Link to="/boards" className="transition-opacity hover:opacity-70">
            Boards
          </Link>
          <span aria-hidden>·</span>
          {signedIn ? (
            <Link to="/discover" className="transition-opacity hover:opacity-70">
              Discover
            </Link>
          ) : (
            <Link to="/login" className="transition-opacity hover:opacity-70">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <Link
        to="/explore"
        className="absolute right-6 bottom-6 z-40 inline-flex items-center gap-2 border border-stage-ink/50 px-4 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-colors hover:bg-stage-ink hover:text-stage"
      >
        See more work <ArrowRightIcon className="size-3.5" />
      </Link>

      {interactive && <CursorDot parallax={parallax} hovering={hovering} />}
    </section>
  );
}

interface StageTileProps {
  tile: Tile;
  parallax: Parallax;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onError: () => void;
}

function StageTile({ tile, parallax, interactive, onHover, onError }: StageTileProps) {
  const { x, y } = useLayerOffset(parallax, tile.slot.depth);
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${tile.slot.x}%`,
        top: `${tile.slot.y}%`,
        width: `${tile.slot.width}vw`,
        zIndex: Math.round(tile.slot.depth * 10),
        x: interactive ? x : 0,
        y: interactive ? y : 0,
      }}
    >
      <Link
        to={`/boards/${tile.collectionId}`}
        aria-label={`Open ${tile.title}`}
        className="group relative block"
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <img
          src={tile.src}
          alt={tile.title}
          draggable={false}
          decoding="async"
          onError={onError}
          className="block h-auto w-full rounded-[2px] object-cover"
        />
        <span className="pointer-events-none absolute -bottom-6 left-0 text-[11px] tracking-[0.2em] uppercase opacity-0 transition-opacity group-hover:opacity-70">
          {tile.title}
        </span>
      </Link>
    </motion.div>
  );
}

/** Replaces the native cursor: a pale dot that trails the pointer and grows over images. */
function CursorDot({ parallax, hovering }: { parallax: Parallax; hovering: boolean }) {
  return (
    <motion.div
      data-testid="cursor-dot"
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50 rounded-full bg-stage-ink mix-blend-difference"
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        marginLeft: -DOT_SIZE / 2,
        marginTop: -DOT_SIZE / 2,
        x: parallax.cursorX,
        y: parallax.cursorY,
      }}
      animate={{ scale: hovering ? DOT_HOVER_SCALE : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    />
  );
}
