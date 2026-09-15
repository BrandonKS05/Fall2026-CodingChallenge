/**
 * Landing hero: images from public boards scattered across a dark stage that
 * drifts against the cursor. Tiles sit at fixed slots on a stage 40% larger
 * than the viewport; each slot has a depth, so near images travel further.
 *
 * The stage is one paint layer on purpose. The cursor dot is absolutely
 * positioned inside the isolated section, the grain overlay is plain paint,
 * and nothing here asks for its own compositor layer, so the dot's difference
 * blend is applied at raster time. A fixed, composited blend layer pushed the
 * whole hero through a full-viewport intermediate surface every frame, which
 * left stale slivers of the moving tiles on screen.
 */
import type { ExploreImage, ExploreImagesResponse } from '@wumboo/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuthDialog } from '@/hooks/useAuthDialog';
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

/**
 * Eighteen fixed slots in fill-priority order: the first is the hero, the first
 * eight cover every quadrant so a short feed still reads balanced. Every slot
 * is at least partly on screen at rest, none sits under the wordmark, the nav,
 * or the call to action, and the slots next to that chrome are far (low depth)
 * so they cannot slide under it.
 */
const SLOTS = [
  { x: 40, y: 37.1, width: 24, depth: 1 },
  { x: 21.4, y: 21.4, width: 16, depth: 0.5 },
  { x: 48.6, y: 65.7, width: 20, depth: 0.45 },
  { x: 64.3, y: 22.1, width: 18, depth: 0.4 },
  { x: 18.6, y: 61.4, width: 18, depth: 0.55 },
  { x: 61.4, y: 42.9, width: 14, depth: 0.6 },
  { x: 45.7, y: 17.1, width: 14, depth: 0.3 },
  { x: 65.7, y: 61.4, width: 12, depth: 0.65 },
  { x: 28.6, y: 45.7, width: 12, depth: 0.7 },
  { x: 35.7, y: 64.3, width: 14, depth: 0.8 },
  { x: 57.1, y: 31.4, width: 10, depth: 0.75 },
  { x: 15.7, y: 41.4, width: 14, depth: 0.35 },
  { x: 35.7, y: 24.3, width: 10, depth: 0.85 },
  { x: 77.1, y: 45.7, width: 16, depth: 0.9 },
  { x: 74.3, y: 65.7, width: 10, depth: 0.35 },
  { x: 8.6, y: 30, width: 14, depth: 0.95 },
  { x: 57.1, y: 7.1, width: 12, depth: 0.5 },
  { x: 31.4, y: 81.4, width: 12, depth: 0.6 },
] satisfies Slot[];

/** One tile per slot. */
const TILE_LIMIT = SLOTS.length;
/** Extra rows fetched so a tile whose image fails to load can be replaced in place. */
const SPARE_IMAGES = 6;
const FETCH_LIMIT = TILE_LIMIT + SPARE_IMAGES;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Tile {
  key: string;
  collectionId: string;
  title: string;
  src: string;
  /** CSS aspect-ratio, so the tile reserves its box before the image loads. */
  aspectRatio: string;
  slotIndex: number;
  slot: Slot;
}

/** Which images failed to load, and which spare now stands in each affected slot. */
interface Placement {
  /** The feed these choices were made for; a new feed starts clean. */
  source: ExploreImage[] | undefined;
  failed: ReadonlySet<string>;
  overrides: ReadonlyMap<number, ExploreImage>;
}

const EMPTY_PLACEMENT: Placement = { source: undefined, failed: new Set(), overrides: new Map() };

/**
 * The server already interleaves boards newest-first and lists each image once;
 * slot order is prominence order. A slot whose image failed shows its spare,
 * or nothing, so every other tile keeps its slot, key, and motion.
 */
function toTiles(images: ExploreImage[], placement: Placement): Tile[] {
  const tiles: Tile[] = [];
  for (const [index, slot] of SLOTS.entries()) {
    const primary = images[index];
    if (!primary) break;
    const entry =
      placement.overrides.get(index) ??
      (placement.failed.has(primary.image.id) ? undefined : primary);
    if (!entry) continue;
    tiles.push({
      key: entry.image.id,
      collectionId: entry.collection.id,
      title: entry.collection.title,
      src: http.url(`/images/${entry.image.id}`),
      aspectRatio: `${entry.image.width} / ${entry.image.height}`,
      slotIndex: index,
      slot,
    });
  }
  return tiles;
}

/**
 * A failed image hands its slot to the next spare nobody holds yet. Spares are
 * claimed in failure order and never recomputed, so an earlier replacement
 * stays put when a later tile (or a spare itself) fails.
 */
function replaceFailed(
  previous: Placement,
  images: ExploreImage[],
  slotIndex: number,
  failedId: string,
): Placement {
  const base = previous.source === images ? previous : EMPTY_PLACEMENT;
  const failed = new Set(base.failed).add(failedId);
  const overrides = new Map(base.overrides);
  const held = new Set([...overrides.values()].map((entry) => entry.image.id));
  const spare = images
    .slice(TILE_LIMIT)
    .find((entry) => !failed.has(entry.image.id) && !held.has(entry.image.id));
  if (spare) overrides.set(slotIndex, spare);
  else overrides.delete(slotIndex);
  return { source: images, failed, overrides };
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
  const auth = useAuthDialog();

  // Through the existing client; a failure simply leaves the stage empty.
  const feed = useQuery({
    queryKey: queryKeys.exploreImages({ limit: FETCH_LIMIT }),
    queryFn: () =>
      http
        .get<ExploreImagesResponse>('/explore/images', { query: { limit: FETCH_LIMIT } })
        .then((response) => response.images),
    retry: false,
    meta: { silentError: true },
  });
  // A tile whose image fails to load (gone upstream, storage outage) gives its
  // slot to a spare rather than showing a broken picture.
  const [placement, setPlacement] = useState<Placement>(EMPTY_PLACEMENT);
  const images = feed.data ?? [];
  const tiles = toTiles(images, placement.source === images ? placement : EMPTY_PLACEMENT);

  return (
    // overflow-clip, not hidden: a clipped box is not a scroll container, so focusing an
    // off-screen tile cannot scroll the stage out from under the chrome and the cursor dot.
    <section
      aria-label="Featured boards"
      className={cn(
        'relative isolate h-svh w-full overflow-clip bg-stage text-stage-ink select-none',
        interactive && 'cursor-none',
      )}
    >
      <div
        aria-hidden
        data-testid="stage-noise"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
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
            onError={() =>
              setPlacement((previous) => replaceFailed(previous, images, tile.slotIndex, tile.key))
            }
          />
        ))}
      </div>

      {/* Scrims keep the chrome legible over bright tiles. Plain paint: no blend, no animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-24 bg-linear-to-b from-stage/70 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-28 bg-linear-to-t from-stage/60 to-transparent"
      />

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
          {/* Color transitions, never opacity: an opacity animation gets its own compositor layer. */}
          <Link to="/explore" className="transition-colors hover:text-stage-ink/70">
            Explore
          </Link>
          <span aria-hidden>·</span>
          <Link to="/boards" className="transition-colors hover:text-stage-ink/70">
            Boards
          </Link>
          <span aria-hidden>·</span>
          {signedIn ? (
            <Link to="/discover" className="transition-colors hover:text-stage-ink/70">
              Discover
            </Link>
          ) : (
            <Link
              to="/login"
              onClick={auth.intercept({ mode: 'login' })}
              className="transition-colors hover:text-stage-ink/70"
            >
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
        style={{ aspectRatio: tile.aspectRatio }}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <img
          src={tile.src}
          alt={tile.title}
          draggable={false}
          decoding="async"
          onError={onError}
          className="block h-full w-full rounded-[2px] object-cover"
        />
        <span className="pointer-events-none absolute -bottom-6 left-0 text-[11px] tracking-[0.2em] text-transparent uppercase transition-colors group-hover:text-stage-ink/70">
          {tile.title}
        </span>
      </Link>
    </motion.div>
  );
}

/**
 * Replaces the native cursor: a pale dot that trails the pointer and grows
 * over images. Absolute, not fixed: the section fills the viewport and never
 * scrolls, and a fixed element would become its own compositor layer.
 */
function CursorDot({ parallax, hovering }: { parallax: Parallax; hovering: boolean }) {
  return (
    <motion.div
      data-testid="cursor-dot"
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-50 rounded-full bg-stage-ink mix-blend-difference"
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
