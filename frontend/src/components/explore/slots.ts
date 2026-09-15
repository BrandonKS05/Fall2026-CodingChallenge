/**
 * The fixed slots of the landing stage and how many tiles it shows. Kept apart
 * from the component so tests and tuning can import them without a React file
 * exporting non-components.
 */
export interface Slot {
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
export const SLOTS = [
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
export const TILE_LIMIT = SLOTS.length;
/** Extra rows fetched so a tile whose image fails to load can be replaced in place. */
export const SPARE_IMAGES = 6;
