/**
 * The fixed slots of the landing stage and how many tiles it shows. Kept apart
 * from the component so tests and tuning can import them without a React file
 * exporting non-components.
 */
/**
 * How far the stage reaches past the viewport, as a percent of it, so slot 0
 * to 100 spans -26vw..126vw. The map is wider than the screen on purpose.
 */
export const STAGE_OVERHANG = 26;

export interface Slot {
  /**
   * Top-left corner, in percent of the enlarged stage: 0 to 100 spans
   * -26vw..126vw, and a slot may sit a little outside that to start off-screen.
   */
  x: number;
  y: number;
  /** Width in vw. */
  width: number;
  /** 0.6 (far, drifts) to 1.25 (near, sweeps past). */
  depth: number;
}

/**
 * Thirty fixed slots, in fill-priority order: the first is the hero, the first
 * eight cover every quadrant so a short feed still reads balanced, and the last
 * fourteen ring the viewport — off the edges at rest, and the reason moving the
 * cursor is worth doing. Nothing overlaps at rest, so the map reads as a
 * scatter rather than a pile.
 *
 * Depth grows with distance from the middle: the tiles at the edges sweep
 * furthest, which is what brings the outer ring into view. The first eight
 * slots take the curation's portrait images, so they are sized for a tall
 * picture; the rest take landscapes.
 */
export const SLOTS = [
  { x: 35.4, y: 21.1, width: 21.0, depth: 0.72 },
  { x: 24.0, y: 32.5, width: 16.1, depth: 0.81 },
  { x: 54.0, y: 30.9, width: 16.4, depth: 0.67 },
  { x: 35.4, y: 53.5, width: 18.0, depth: 0.78 },
  { x: 77.0, y: 43.4, width: 18.5, depth: 1.0 },
  { x: 15.7, y: 10.7, width: 14.0, depth: 1.11 },
  { x: 65.9, y: 32.2, width: 15.7, depth: 0.82 },
  { x: 11.5, y: 41.4, width: 17.9, depth: 0.99 },
  { x: 71.6, y: 72.0, width: 15.7, depth: 1.07 },
  { x: 55.2, y: 70.3, width: 15.1, depth: 0.91 },
  { x: 70.7, y: 20.7, width: 14.8, depth: 1.01 },
  { x: 33.8, y: 81.3, width: 14.5, depth: 1.06 },
  { x: 56.2, y: 57.9, width: 14.2, depth: 0.75 },
  { x: 51.1, y: 20.6, width: 13.1, depth: 0.87 },
  { x: 21.4, y: 69.5, width: 12.1, depth: 1.01 },
  { x: 37.8, y: 12.0, width: 11.5, depth: 1.01 },
  { x: -0.4, y: 44.9, width: 16.9, depth: 1.16 },
  { x: 58.6, y: 86.1, width: 14.2, depth: 1.14 },
  { x: 57.8, y: 1.8, width: 16.1, depth: 1.15 },
  { x: 90.9, y: 42.4, width: 15.8, depth: 1.18 },
  { x: 0.2, y: 64.3, width: 16.0, depth: 1.22 },
  { x: 41.7, y: -0.7, width: 11.1, depth: 1.19 },
  { x: 41.0, y: 92.6, width: 17.0, depth: 1.22 },
  { x: 2.3, y: 22.3, width: 14.8, depth: 1.21 },
  { x: 89.9, y: 68.5, width: 10.4, depth: 1.22 },
  { x: 19.9, y: 2.2, width: 10.6, depth: 1.25 },
  { x: 91.9, y: 23.9, width: 14.0, depth: 1.25 },
  { x: 17.2, y: 87.7, width: 16.2, depth: 1.25 },
  { x: 79.1, y: 2.3, width: 10.3, depth: 1.25 },
  { x: 78.2, y: 89.4, width: 12.9, depth: 1.25 },
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
