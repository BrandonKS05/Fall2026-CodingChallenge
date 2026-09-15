/**
 * Landing hero: a fixed curation of images scattered across a dark stage that
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
import type { Image as LandingImage, LandingImagesResponse } from '@wumboo/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import { http, queryKeys } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SLOTS, SPARE_IMAGES, TILE_LIMIT, type Slot } from './slots';
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

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Tile {
  key: string;
  src: string;
  /** The photographer, which is both the caption and the attribution Pixabay asks for. */
  title: string;
  /** CSS aspect-ratio, so the tile reserves its box before the image loads. */
  aspectRatio: string;
  slotIndex: number;
  slot: Slot;
}

/** Which images failed to load, and which spare now stands in each affected slot. */
interface Placement {
  /** The feed these choices were made for; a new feed starts clean. */
  source: LandingImage[] | undefined;
  failed: ReadonlySet<string>;
  overrides: ReadonlyMap<number, LandingImage>;
}

const EMPTY_PLACEMENT: Placement = { source: undefined, failed: new Set(), overrides: new Map() };

/**
 * Slot order is prominence order, and the curation arrives in a fixed order, so
 * the stage looks the same on every visit. A slot whose image failed shows its
 * spare, or nothing, so every other tile keeps its slot, key, and motion.
 */
function toTiles(images: LandingImage[], placement: Placement, slots: Slot[]): Tile[] {
  const tiles: Tile[] = [];
  for (const [index, slot] of slots.entries()) {
    const primary = images[index];
    if (!primary) break;
    const entry =
      placement.overrides.get(index) ?? (placement.failed.has(primary.id) ? undefined : primary);
    if (!entry) continue;
    tiles.push({
      key: entry.id,
      src: http.url(`/images/${entry.id}`),
      title: entry.credit.name,
      aspectRatio: `${entry.width} / ${entry.height}`,
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
  images: LandingImage[],
  slotIndex: number,
  failedId: string,
  slotLimit: number,
): Placement {
  const base = previous.source === images ? previous : EMPTY_PLACEMENT;
  const failed = new Set(base.failed).add(failedId);
  const overrides = new Map(base.overrides);
  const held = new Set([...overrides.values()].map((entry) => entry.id));
  const spare = images
    .slice(slotLimit)
    .find((entry) => !failed.has(entry.id) && !held.has(entry.id));
  if (spare) overrides.set(slotIndex, spare);
  else overrides.delete(slotIndex);
  return { source: images, failed, overrides };
}

export interface ExploreCanvasProps {
  /** Swaps the "Sign in" link for "Discover" once there is a session. */
  signedIn?: boolean;
  /** Goes at the start of the chrome's links. Passed in, because this is a feature component. */
  chromeLeading?: ReactNode;
  tuning?: ParallaxTuning;
  slots?: Slot[];
  slotLimit?: number;
  spareImages?: number;
  stageScale?: number;
}

export function ExploreCanvas({
  signedIn = false,
  chromeLeading,
  tuning = DEFAULT_TUNING,
  slots = SLOTS,
  slotLimit = TILE_LIMIT,
  spareImages = SPARE_IMAGES,
  stageScale = 1,
}: ExploreCanvasProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const interactive = !reducedMotion && !coarsePointer;
  const parallax = useParallax(interactive, tuning);
  const [hovering, setHovering] = useState(false);
  const feedLimit = slotLimit + spareImages;

  // The curated feed, through the existing client; a failure leaves the stage empty.
  const feed = useQuery({
    queryKey: queryKeys.landingImages({ limit: feedLimit }),
    queryFn: () =>
      http
        .get<LandingImagesResponse>('/landing/images', { query: { limit: feedLimit } })
        .then((response) => response.images),
    retry: false,
    meta: { silentError: true },
  });
  // A tile whose image fails to load (gone upstream, storage outage) gives its
  // slot to a spare rather than showing a broken picture.
  const [placement, setPlacement] = useState<Placement>(EMPTY_PLACEMENT);
  const images = feed.data ?? [];
  const tiles = toTiles(images, placement.source === images ? placement : EMPTY_PLACEMENT, slots);

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

      <div
        className="absolute inset-[-26%]"
        style={{ transform: `scale(${stageScale})`, transformOrigin: 'center center' }}
      >
        {tiles.map((tile) => (
          <StageTile
            key={tile.key}
            tile={tile}
            parallax={parallax}
            interactive={interactive}
            onHover={setHovering}
            onError={() =>
              setPlacement((previous) =>
                replaceFailed(previous, images, tile.slotIndex, tile.key, slotLimit),
              )
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

      <StageChrome signedIn={signedIn} leading={chromeLeading} />

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
      {/* The curation belongs to no board, so every tile leads to Explore, which
          is where the app's own boards live. The caption credits the
          photographer, which is what Pixabay asks for in return. */}
      <Link
        to="/explore"
        aria-label={`Explore — photo by ${tile.title}`}
        className="group relative block"
        style={{ aspectRatio: tile.aspectRatio }}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <img
          data-testid="stage-tile"
          src={tile.src}
          alt={`Photo by ${tile.title}`}
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
