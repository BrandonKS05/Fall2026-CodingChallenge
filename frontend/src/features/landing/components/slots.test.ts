import { describe, expect, it } from 'vitest';
import { SLOTS, SPARE_IMAGES, STAGE_OVERHANG, TILE_LIMIT } from './slots';
import { DEFAULT_TUNING } from './useParallax';

/** A laptop, in CSS pixels: the size the map was laid out against. */
const VIEW = { width: 1440, height: 900 };
const SPAN = 100 + 2 * STAGE_OVERHANG;
/** The clear space every tile keeps from its neighbours, in viewport units. */
const MARGIN = 3;
/**
 * The curation is portrait first, then landscape, and slots take it in order.
 * The narrowest landscape stands for all of them: a wider one is only shorter,
 * so spacing that holds here holds for every picture.
 */
const aspectOf = (index: number) => (index < 8 ? 0.7 : 1.33);

/** Where a slot's tile sits at rest, in percent of the viewport. */
function restBox(index: number) {
  const slot = SLOTS[index]!;
  const left = -STAGE_OVERHANG + (slot.x * SPAN) / 100;
  const top = -STAGE_OVERHANG + (slot.y * SPAN) / 100;
  const heightVh = ((slot.width / 100) * VIEW.width) / aspectOf(index) / (VIEW.height / 100);
  return { left, top, right: left + slot.width, bottom: top + heightVh, depth: slot.depth };
}

describe('the landing map', () => {
  it('shows every curated image once, with spares to cover a failure', () => {
    expect(TILE_LIMIT).toBe(SLOTS.length);
    // The curation holds 48; the feed asks for the slots plus the spares.
    expect(TILE_LIMIT + SPARE_IMAGES).toBeLessThanOrEqual(48);
  });

  it('scatters the tiles: every one keeps a clear margin from the rest', () => {
    const piled: string[] = [];
    for (let i = 0; i < SLOTS.length; i += 1) {
      for (let j = i + 1; j < SLOTS.length; j += 1) {
        const a = restBox(i);
        const b = restBox(j);
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // A margin, not just no overlap: the stage should read as a scatter.
        if (across > -MARGIN && down > -MARGIN) piled.push(`${i}/${j}`);
      }
    }
    expect(piled).toEqual([]);
  });

  it('keeps a ring of tiles off the edges, each near enough to be swept into view', () => {
    const offscreen = SLOTS.map((_, index) => restBox(index)).filter(
      (box) => box.right < 0 || box.left > 100 || box.bottom < 0 || box.top > 100,
    );
    // Most of the map waits off the edges; that is what there is to move around.
    expect(offscreen.length).toBeGreaterThanOrEqual(SLOTS.length / 2);

    // Travel is in pixels; what matters is how much of the screen it covers.
    for (const box of offscreen) {
      const across = ((DEFAULT_TUNING.travel * box.depth) / VIEW.width) * 100;
      const down = ((DEFAULT_TUNING.travelY * box.depth) / VIEW.height) * 100;
      const gap = Math.max(-box.right, box.left - 100, 0);
      const drop = Math.max(-box.bottom, box.top - 100, 0);
      expect(gap).toBeLessThan(across);
      expect(drop).toBeLessThan(down);
    }
  });
});
