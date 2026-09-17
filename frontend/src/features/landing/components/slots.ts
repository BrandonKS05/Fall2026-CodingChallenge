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
  /**
   * width / height of the tile, which is the slot's own and not the picture's.
   * The layout is spaced against these, so a tall photograph dropped into a
   * wide slot is cropped rather than allowed to shove its neighbours around.
   */
  aspect: number;
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
  { x: 57.0, y: 35.8, width: 20.0, depth: 0.73, aspect: 0.7 },
  { x: 36.1, y: 22.2, width: 18.7, depth: 0.76, aspect: 0.7 },
  { x: 51.3, y: 6.4, width: 17.8, depth: 0.97, aspect: 0.7 },
  { x: 29.3, y: 52.9, width: 19.6, depth: 0.86, aspect: 0.7 },
  { x: 70.9, y: 68.5, width: 19.8, depth: 1.13, aspect: 0.7 },
  { x: 16.3, y: 9.0, width: 17.7, depth: 1.08, aspect: 0.7 },
  { x: 72.8, y: 9.7, width: 17.6, depth: 1.08, aspect: 0.7 },
  { x: 3.8, y: 52.0, width: 16.6, depth: 1.13, aspect: 0.7 },
  { x: 44.8, y: 70.3, width: 15.9, depth: 0.91, aspect: 1.33 },
  { x: 57.9, y: 71.2, width: 15.7, depth: 0.96, aspect: 1.33 },
  { x: 32.4, y: 7.2, width: 15.6, depth: 1.07, aspect: 1.33 },
  { x: 17.3, y: 67.3, width: 14.2, depth: 1.04, aspect: 1.33 },
  { x: 14.5, y: 38.2, width: 14.1, depth: 0.97, aspect: 1.33 },
  { x: 72.8, y: 53.1, width: 14.1, depth: 0.94, aspect: 1.33 },
  { x: 45.2, y: 53.4, width: 13.9, depth: 0.67, aspect: 1.33 },
  { x: 72.8, y: 39.2, width: 13.1, depth: 0.92, aspect: 1.33 },
  { x: 91.4, y: 46.7, width: 12.6, depth: 1.16, aspect: 1.33 },
  { x: 56.7, y: -5.8, width: 12.1, depth: 1.25, aspect: 1.33 },
  { x: -8.1, y: 44.1, width: 14.0, depth: 1.27, aspect: 1.33 },
  { x: 39.4, y: 93.0, width: 15.7, depth: 1.22, aspect: 1.33 },
  { x: 56.3, y: 93.5, width: 12.2, depth: 1.21, aspect: 1.33 },
  { x: 2.5, y: 19.8, width: 12.1, depth: 1.23, aspect: 1.33 },
  { x: 90.7, y: 68.6, width: 12.6, depth: 1.23, aspect: 1.33 },
  { x: 38.6, y: -6.7, width: 14.2, depth: 1.24, aspect: 1.33 },
  { x: 91.8, y: 21.5, width: 13.0, depth: 1.25, aspect: 1.33 },
  { x: -6.9, y: 67.5, width: 12.2, depth: 1.32, aspect: 1.33 },
  { x: 18.3, y: -2.0, width: 10.6, depth: 1.3, aspect: 1.33 },
  { x: 16.6, y: 91.1, width: 12.9, depth: 1.29, aspect: 1.33 },
  { x: 86.5, y: 91.6, width: 15.5, depth: 1.35, aspect: 1.33 },
  { x: 102.9, y: 29.9, width: 15.9, depth: 1.35, aspect: 1.33 },
  { x: 81.7, y: -4.8, width: 12.8, depth: 1.35, aspect: 1.33 },
  { x: 26.1, y: -16.5, width: 15.0, depth: 1.35, aspect: 1.33 },
  { x: -16.2, y: 57.8, width: 10.1, depth: 1.35, aspect: 1.33 },
  { x: 51.7, y: -19.1, width: 13.2, depth: 1.35, aspect: 1.33 },
  { x: 50.3, y: 109.8, width: 11.7, depth: 1.35, aspect: 1.33 },
  { x: 71.4, y: -13.8, width: 11.6, depth: 1.35, aspect: 1.33 },
  { x: 31.6, y: 108.9, width: 11.0, depth: 1.35, aspect: 1.33 },
  { x: -17.9, y: 27.2, width: 14.6, depth: 1.35, aspect: 1.33 },
  { x: 111.1, y: 60.5, width: 10.1, depth: 1.35, aspect: 1.33 },
  { x: 74.0, y: 106.5, width: 14.2, depth: 1.35, aspect: 1.33 },
  { x: 100.6, y: 101.3, width: 14.2, depth: 1.35, aspect: 1.33 },
  { x: -9.4, y: -12.1, width: 11.7, depth: 1.35, aspect: 1.33 },
] satisfies Slot[];

/** One tile per slot. */
export const TILE_LIMIT = SLOTS.length;
/** Extra rows fetched so a tile whose image fails to load can be replaced in place. */
export const SPARE_IMAGES = 6;
