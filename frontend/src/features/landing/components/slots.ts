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

export const EXPLORE_SLOTS = [
  { x: 39, y: 34, width: 11.2, depth: 1 },
  { x: 19, y: 19, width: 8.6, depth: 0.46 },
  { x: 49, y: 16, width: 8.6, depth: 0.38 },
  { x: 68, y: 22, width: 8.6, depth: 0.34 },
  { x: 62, y: 41, width: 7.1, depth: 0.5 },
  { x: 32, y: 47, width: 7.1, depth: 0.64 },
  { x: 8, y: 37, width: 8.5, depth: 0.28 },
  { x: 49, y: 58, width: 7.1, depth: 0.72 },
  { x: 69, y: 61, width: 7.1, depth: 0.56 },
  { x: 19, y: 68, width: 7.6, depth: 0.76 },
  { x: 82, y: 44, width: 7.1, depth: 0.4 },
  { x: 72, y: 11, width: 5.7, depth: 0.2 },
  { x: 52, y: 8, width: 6.2, depth: 0.24 },
  { x: 24, y: 10, width: 5.7, depth: 0.22 },
  { x: 10, y: 64, width: 7.1, depth: 0.48 },
  { x: 84, y: 72, width: 6.2, depth: 0.34 },
  { x: 56, y: 81, width: 7.1, depth: 0.62 },
  { x: 39, y: 83, width: 6.4, depth: 0.58 },
  { x: 4, y: 21, width: 5.6, depth: 0.2 },
  { x: 91, y: 19, width: 5.1, depth: 0.18 },
  { x: 62, y: 30, width: 5.7, depth: 0.42 },
  { x: 33, y: 31, width: 5.7, depth: 0.58 },
  { x: 76, y: 79, width: 5.8, depth: 0.44 },
  { x: 16, y: 84, width: 5.1, depth: 0.36 },
  { x: 47, y: 49, width: 5.6, depth: 0.46 },
  { x: 28, y: 57, width: 5.5, depth: 0.66 },
  { x: 71, y: 50, width: 5.5, depth: 0.52 },
  { x: 43, y: 23, width: 5.4, depth: 0.28 },
  { x: 12, y: 53, width: 5.1, depth: 0.42 },
  { x: 60, y: 66, width: 5.1, depth: 0.74 },
  { x: 78, y: 32, width: 4.8, depth: 0.22 },
  { x: 28, y: 74, width: 4.6, depth: 0.7 },
  { x: 88, y: 58, width: 4.6, depth: 0.3 },
  { x: 52, y: 28, width: 4.8, depth: 0.32 },
  { x: 35, y: 10, width: 4.5, depth: 0.18 },
  { x: 6, y: 76, width: 4.6, depth: 0.38 },
] satisfies Slot[];

/** One tile per slot. */
export const TILE_LIMIT = SLOTS.length;
export const EXPLORE_TILE_LIMIT = EXPLORE_SLOTS.length;
/** Extra rows fetched so a tile whose image fails to load can be replaced in place. */
export const SPARE_IMAGES = 6;
export const EXPLORE_SPARE_IMAGES = 12;
