/** Buttons for the dark stage pages, which cannot use the theme's primary color (it follows light/dark mode). */
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const base =
  'inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stage-ink disabled:opacity-50';

const stageButtonVariants = {
  solid: 'border-stage-ink bg-stage-ink text-stage hover:bg-transparent hover:text-stage-ink',
  outline: 'border-stage-ink/50 text-stage-ink hover:bg-stage-ink hover:text-stage',
} as const;

function stageButtonClass(variant: keyof typeof stageButtonVariants = 'solid') {
  return cn(base, stageButtonVariants[variant]);
}

export function StageButton({
  variant = 'solid',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof stageButtonVariants }) {
  return <button type={type} className={cn(stageButtonClass(variant), className)} {...props} />;
}
