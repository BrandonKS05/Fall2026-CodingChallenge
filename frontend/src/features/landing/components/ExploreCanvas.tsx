/**
 * Landing hero: a fixed curation of images scattered across a map larger than
 * the screen, which drifts against the cursor. Tiles sit at fixed slots on a
 * stage half again as wide as the viewport, and a ring of them starts off the
 * edges; each slot has a depth, so the nearer ones sweep further and the ring
 * comes into view as you move.
 *
 * The stage is one paint layer on purpose. The cursor dot is absolutely
 * positioned inside the isolated section, the grain overlay is plain paint,
 * and nothing here asks for its own compositor layer, so the dot's difference
 * blend is applied at raster time. A fixed, composited blend layer pushed the
 * whole hero through a full-viewport intermediate surface every frame, which
 * left stale slivers of the moving tiles on screen.
 */
import type {
  ExploreImagesResponse,
  Image as LandingImage,
  LandingImagesResponse,
} from '@wumboo/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import { http, queryKeys } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SLOTS, SPARE_IMAGES, STAGE_OVERHANG, TILE_LIMIT, type Slot } from './slots';
import {
  DEFAULT_TUNING,
  useLayerOffset,
  useMediaQuery,
  useParallax,
  type Parallax,
  type ParallaxTuning,
} from './useParallax';

/** The viewport shape the slot table was laid out against: 16:10. */
const DESIGN_ASPECT = 1.6;

/** Custom cursor dot, in px, and how much it grows over an image. */
const DOT_SIZE = 12;
const DOT_HOVER_SCALE = 1.6;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Tile {
  key: string;
  src: string;
  /** The board this picture is on, when it is on one. */
  href: string;
  /** What the link says it opens: a board by name, or Explore. */
  opens: string;
  /** The photographer, which is both the caption and the attribution Pixabay asks for. */
  title: string;
  /** CSS aspect-ratio of the slot, so the box is the same before and after loading. */
  aspectRatio: string;
  slotIndex: number;
  slot: Slot;
}

/**
 * A picture on the stage: one of the app's own public boards when there is one
 * to show, and otherwise from the fixed curation, which belongs to nobody.
 */
interface StageImage extends LandingImage {
  board?: { id: string; title: string };
}

/** Which images failed to load, and which spare now stands in each affected slot. */
interface Placement {
  /** The feed these choices were made for; a new feed starts clean. */
  source: StageImage[] | undefined;
  failed: ReadonlySet<string>;
  overrides: ReadonlyMap<number, StageImage>;
}

const EMPTY_PLACEMENT: Placement = { source: undefined, failed: new Set(), overrides: new Map() };

/**
 * Slot order is prominence order, and the feed arrives in a fixed order, so the
 * stage looks the same on every visit. A slot whose image failed shows its
 * spare, or nothing, so every other tile keeps its slot, key, and motion.
 */
function toTiles(images: StageImage[], placement: Placement, slots: Slot[]): Tile[] {
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
      href: entry.board ? `/boards/${entry.board.id}` : '/explore',
      opens: entry.board ? entry.board.title : 'Explore',
      // The slot's shape, not the picture's: the map's spacing depends on it.
      aspectRatio: String(slot.aspect),
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
  images: StageImage[],
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

  // What people have actually made public, so a tile opens the board it is on.
  const boards = useQuery({
    queryKey: queryKeys.exploreImages({ limit: feedLimit }),
    queryFn: () =>
      http
        .get<ExploreImagesResponse>('/explore/images', { query: { limit: feedLimit } })
        .then((response) =>
          response.images.map((entry): StageImage => ({ ...entry.image, board: entry.collection })),
        ),
    retry: false,
    meta: { silentError: true },
  });
  // The fixed curation tops up the stage when there are not enough public
  // boards to fill it, so the front of the product is never half empty.
  const curated = useQuery({
    queryKey: queryKeys.landingImages({ limit: feedLimit }),
    queryFn: () =>
      http
        .get<LandingImagesResponse>('/landing/images', { query: { limit: feedLimit } })
        .then((response) => response.images as StageImage[]),
    enabled: boards.isSuccess && boards.data.length < feedLimit,
    retry: false,
    meta: { silentError: true },
  });
  const feed = {
    isPending: boards.isPending,
    data: useMemo(() => {
      const fromBoards = boards.data ?? [];
      if (fromBoards.length >= feedLimit) return fromBoards;
      const seen = new Set(fromBoards.map((image) => image.id));
      return [...fromBoards, ...(curated.data ?? []).filter((image) => !seen.has(image.id))];
    }, [boards.data, curated.data, feedLimit]),
  };
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
        className="absolute"
        style={{
          inset: `${-STAGE_OVERHANG}%`,
          transform: `scale(${stageScale})`,
          transformOrigin: 'center center',
        }}
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
        // A tile's width is capped by the viewport's height as well as its
        // width, so on a wide screen the tiles shrink instead of growing
        // taller and walking into each other. The vh figure is the vw one at
        // the 16:10 the map was laid out against.
        width: `min(${tile.slot.width}vw, ${(tile.slot.width * DESIGN_ASPECT).toFixed(1)}vh)`,
        zIndex: Math.round(tile.slot.depth * 10),
        x: interactive ? x : 0,
        y: interactive ? y : 0,
      }}
    >
      {/* A picture on a public board opens that board; one from the curation,
          which belongs to nobody, opens Explore instead. The caption credits
          the photographer, which is what Pixabay asks for in return. */}
      <Link
        to={tile.href}
        aria-label={`${tile.opens} — photo by ${tile.title}`}
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
