/**
 * Cursor-driven parallax for the landing hero. Strategy: `useParallax(enabled)`
 * picks tracking or a static scatter (reduced motion, touch) and the tiles
 * never know which one they got.
 *
 * Feel lives in `DEFAULT_TUNING`:
 * - `travel`: how far a depth-1 layer moves at the viewport edge (px). Bigger = more drama.
 * - `stiffness` / `damping`: the spring the images follow. Lower stiffness = lazier glide;
 *   lower damping = more overshoot. 60/20 glides without bouncing.
 * - `cursorStiffness`: the dot's spring. Keep it above `stiffness` so the dot leads the images.
 */
import { useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useState } from 'react';

export interface ParallaxTuning {
  travel: number;
  stiffness: number;
  damping: number;
  cursorStiffness: number;
}

export const DEFAULT_TUNING: ParallaxTuning = {
  travel: 120,
  stiffness: 60,
  damping: 20,
  cursorStiffness: 110,
};

export interface Parallax {
  /** Pointer offset from the viewport center in [-1, 1], spring-smoothed. */
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
  /** Pointer position in viewport pixels, spring-smoothed for the custom cursor. */
  cursorX: MotionValue<number>;
  cursorY: MotionValue<number>;
  tuning: ParallaxTuning;
}

/** Tracks a media query. Starts from the current value and follows changes; safe where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Listens to the pointer while `enabled` and exposes smoothed motion values.
 * When disabled (reduced motion, touch), the values stay at rest and nothing is subscribed.
 */
export function useParallax(enabled: boolean, tuning: ParallaxTuning = DEFAULT_TUNING): Parallax {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  // Off-screen until the first move, so the dot never flashes at the origin.
  const pointerX = useMotionValue(-100);
  const pointerY = useMotionValue(-100);

  const offsetX = useSpring(rawX, { stiffness: tuning.stiffness, damping: tuning.damping });
  const offsetY = useSpring(rawY, { stiffness: tuning.stiffness, damping: tuning.damping });
  const cursorX = useSpring(pointerX, {
    stiffness: tuning.cursorStiffness,
    damping: tuning.damping,
  });
  const cursorY = useSpring(pointerY, {
    stiffness: tuning.cursorStiffness,
    damping: tuning.damping,
  });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1);
      rawY.set((event.clientY / window.innerHeight) * 2 - 1);
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled, rawX, rawY, pointerX, pointerY]);

  return { offsetX, offsetY, cursorX, cursorY, tuning };
}

/** Translation for one layer. Depth 1 travels the full distance, opposite to the cursor; depth 0.3 barely moves. */
export function useLayerOffset(parallax: Parallax, depth: number) {
  const distance = parallax.tuning.travel * depth;
  const x = useTransform(parallax.offsetX, (value) => -value * distance);
  const y = useTransform(parallax.offsetY, (value) => -value * distance);
  return { x, y };
}
