/**
 * A card that floats: a slow idle drift, and a 3D tilt that follows the pointer
 * while it hovers, with a spring so it settles instead of snapping. Reduced
 * motion turns both off. Used for board cards, so a board page feels like the
 * landing stage rather than a table.
 */
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Degrees of tilt at the card's edge. */
const TILT = 10;

interface FloatingCardProps {
  children: ReactNode;
  /** Staggers the idle drift so neighbours are never in step. */
  index?: number;
  className?: string;
}

export function FloatingCard({ children, index = 0, className }: FloatingCardProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 220, damping: 22 });
  const rotateY = useSpring(tiltY, { stiffness: 220, damping: 22 });

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    tiltX.set(-y * TILT * 2);
    tiltY.set(x * TILT * 2);
  };
  const settle = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <div
      className={cn('motion-safe:animate-float', className)}
      style={{ perspective: 900, animationDelay: `${(index % 5) * 0.7}s` }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={reducedMotion ? undefined : { scale: 1.03 }}
        onPointerMove={reducedMotion ? undefined : follow}
        onPointerLeave={settle}
        className="h-full rounded-xl"
      >
        {children}
      </motion.div>
    </div>
  );
}
