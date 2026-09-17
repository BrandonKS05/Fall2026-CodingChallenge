import { describe, expect, it } from 'vitest';
import { SLOTS, SPARE_IMAGES, STAGE_OVERHANG, TILE_LIMIT } from './slots';
import { DEFAULT_TUNING } from './useParallax';

/** A laptop, in CSS pixels: the size the map was laid out against. */
const VIEW = { width: 1440, height: 900 };
const SPAN = 100 + 2 * STAGE_OVERHANG;
/** The clear space every tile keeps from its neighbours, in viewport units. */
const MARGIN = 3;
/** The viewport shape the table was laid out against, as the component uses it. */
const DESIGN_ASPECT = 1.6;
/** Every shape a screen comes in, since the map has to hold on all of them. */
const ASPECTS = [4 / 3, 16 / 10, 16 / 9, 21 / 9];
/**
 * The slot's own shape. Pictures are cropped to it, so the geometry here is
 * the geometry on screen whatever arrives from the feed.
 */
const aspectOf = (index: number) => SLOTS[index]?.aspect ?? 1.33;

/** Where a slot's tile sits at rest, in percent of the viewport. */
function restBox(index: number, aspect = VIEW.width / VIEW.height) {
  const slot = SLOTS[index]!;
  const left = -STAGE_OVERHANG + (slot.x * SPAN) / 100;
  const top = -STAGE_OVERHANG + (slot.y * SPAN) / 100;
  // `min(Xvw, Yvh)`, as the component renders it: what keeps a wide screen
  // from stretching the tiles into one another.
  const widthVw = Math.min(slot.width, (slot.width * DESIGN_ASPECT) / aspect);
  const heightVh = (widthVw * aspect) / aspectOf(index);
  return { left, top, right: left + widthVw, bottom: top + heightVh, depth: slot.depth };
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

  it('holds its spacing on every shape of screen, wide ones included', () => {
    for (const aspect of ASPECTS) {
      const overlapping: string[] = [];
      for (let i = 0; i < SLOTS.length; i += 1) {
        for (let j = i + 1; j < SLOTS.length; j += 1) {
          const a = restBox(i, aspect);
          const b = restBox(j, aspect);
          const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (across > 0 && down > 0) overlapping.push(`${aspect.toFixed(2)}: ${i}/${j}`);
        }
      }
      expect(overlapping).toEqual([]);
    }
  });

  it('cannot let one tile overtake another, however far the map is moved', () => {
    // Two tiles cross only if the difference in how far they travel closes the
    // gap between them on both axes at once, so the spread of depths is capped
    // by the tightest gap in the scatter.
    for (const [aspect, width, height] of [
      [4 / 3, 1024, 768],
      [16 / 10, 1440, 900],
      [21 / 9, 2560, 1100],
    ] as const) {
      const acrossShare = (DEFAULT_TUNING.travel / width) * 100;
      const downShare = (DEFAULT_TUNING.travelY / height) * 100;
      for (let i = 0; i < SLOTS.length; i += 1) {
        for (let j = i + 1; j < SLOTS.length; j += 1) {
          const a = restBox(i, aspect);
          const b = restBox(j, aspect);
          const gapAcross = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
          const gapDown = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
          const drift = Math.abs(a.depth - b.depth);
          const clearance = Math.max(gapAcross / acrossShare, gapDown / downShare);
          expect(drift).toBeLessThan(clearance);
        }
      }
    }
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
