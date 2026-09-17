/**
 * What a visitor sees past the free part: the real thing, blurred and inert,
 * behind an invitation. Blurred rather than cut off, because "there is more"
 * is only persuasive when you can see that there is.
 */
import type { ReactNode } from 'react';
import { StageButton } from '@/components/common/StageButton';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { cn } from '@/lib/utils';

export function LockedPreview({
  children,
  headline = 'There is more.',
  message,
  tone = 'paper',
  className,
}: {
  /** The content to show blurred. It is aria-hidden: nobody reads a tease. */
  children: ReactNode;
  headline?: string;
  message: string;
  /** Which surface it sits on, so the card matches the page around it. */
  tone?: 'stage' | 'paper';
  className?: string;
}) {
  const auth = useAuthDialog();
  const onStage = tone === 'stage';

  return (
    <div className={cn('relative max-h-[min(60svh,520px)] overflow-hidden', className)}>
      <div aria-hidden className="pointer-events-none blur-[6px] select-none">
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 bg-linear-to-b',
          onStage
            ? 'from-stage/20 via-stage/40 to-stage'
            : 'from-background/20 via-background/50 to-background',
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className={cn(
            'max-w-sm px-8 py-7 text-center backdrop-blur-xs',
            onStage
              ? 'border border-stage-ink/40 bg-stage/80 text-stage-ink'
              : 'rounded-2xl border border-border bg-background/85 text-foreground shadow-sm',
          )}
        >
          <p className="font-hand text-5xl leading-none">{headline}</p>
          <p
            className={cn(
              'mt-3 text-[11px] tracking-[0.2em] uppercase',
              onStage ? 'text-stage-ink/70' : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <StageButton onClick={() => auth.open({ mode: 'login' })}>Sign in</StageButton>
            <StageButton variant="outline" onClick={() => auth.open({ mode: 'register' })}>
              Create an account
            </StageButton>
          </div>
        </div>
      </div>
    </div>
  );
}
