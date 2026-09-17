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
 * Forty-two fixed slots, in fill-priority order: the first is the hero, the
 * first eight cover every quadrant so a short feed still reads balanced, and
 * the rest ring the viewport in two bands — the nearer one just off the edges,
 * the far one a screen's width beyond it. Two thirds of the map starts out of
 * sight, which is the whole reason to move.
 *
 * Nothing overlaps at rest and every tile keeps a clear margin, so the stage
 * reads as a scatter rather than a pile. Depth grows with distance from the
 * middle: the far band sweeps furthest, which is what carries it into view.
 * The first eight slots take the curation's portrait images and are sized for
 * a tall picture; the rest take landscapes.
 */
export const SLOTS = [
  { x: 57.0, y: 35.8, width: 20.0, depth: 0.73 },
  { x: 36.1, y: 22.2, width: 18.7, depth: 0.76 },
  { x: 51.3, y: 6.4, width: 17.8, depth: 0.97 },
  { x: 29.3, y: 52.9, width: 19.6, depth: 0.86 },
  { x: 70.9, y: 68.5, width: 19.8, depth: 1.13 },
  { x: 16.3, y: 9.0, width: 17.7, depth: 1.08 },
  { x: 72.8, y: 9.7, width: 17.6, depth: 1.08 },
  { x: 3.8, y: 52.0, width: 16.6, depth: 1.13 },
  { x: 44.8, y: 70.3, width: 15.9, depth: 0.91 },
  { x: 57.9, y: 71.2, width: 15.7, depth: 0.96 },
  { x: 32.4, y: 7.2, width: 15.6, depth: 1.07 },
  { x: 17.3, y: 67.3, width: 14.2, depth: 1.04 },
  { x: 14.5, y: 38.2, width: 14.1, depth: 0.97 },
  { x: 72.8, y: 53.1, width: 14.1, depth: 0.94 },
  { x: 45.2, y: 53.4, width: 13.9, depth: 0.67 },
  { x: 72.8, y: 39.2, width: 13.1, depth: 0.92 },
  { x: 91.4, y: 46.7, width: 12.6, depth: 1.16 },
  { x: 56.7, y: -5.8, width: 12.1, depth: 1.25 },
  { x: -8.1, y: 44.1, width: 14.0, depth: 1.27 },
  { x: 39.4, y: 93.0, width: 15.7, depth: 1.22 },
  { x: 56.3, y: 93.5, width: 12.2, depth: 1.21 },
  { x: 2.5, y: 19.8, width: 12.1, depth: 1.23 },
  { x: 90.7, y: 68.6, width: 12.6, depth: 1.23 },
  { x: 38.6, y: -6.7, width: 14.2, depth: 1.24 },
  { x: 91.8, y: 21.5, width: 13.0, depth: 1.25 },
  { x: -6.9, y: 67.5, width: 12.2, depth: 1.32 },
  { x: 18.3, y: -2.0, width: 10.6, depth: 1.3 },
  { x: 16.6, y: 91.1, width: 12.9, depth: 1.29 },
  { x: 86.5, y: 91.6, width: 15.5, depth: 1.35 },
  { x: 102.9, y: 29.9, width: 15.9, depth: 1.35 },
  { x: 81.7, y: -4.8, width: 12.8, depth: 1.35 },
  { x: 26.1, y: -16.5, width: 15.0, depth: 1.35 },
  { x: -16.2, y: 57.8, width: 10.1, depth: 1.35 },
  { x: 51.7, y: -19.1, width: 13.2, depth: 1.35 },
  { x: 50.3, y: 109.8, width: 11.7, depth: 1.35 },
  { x: 71.4, y: -13.8, width: 11.6, depth: 1.35 },
  { x: 31.6, y: 108.9, width: 11.0, depth: 1.35 },
  { x: -17.9, y: 27.2, width: 14.6, depth: 1.35 },
  { x: 111.1, y: 60.5, width: 10.1, depth: 1.35 },
  { x: 74.0, y: 106.5, width: 14.2, depth: 1.35 },
  { x: 100.6, y: 101.3, width: 14.2, depth: 1.35 },
  { x: -9.4, y: -12.1, width: 11.7, depth: 1.35 },
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
