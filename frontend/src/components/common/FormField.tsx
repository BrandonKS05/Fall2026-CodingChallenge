import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  error?: string | undefined;
  /** Sits inside the left edge and is part of the value's meaning, like the @ on a handle. */
  prefix?: string;
  /** Sits inside the right edge: a reveal button, a spinner, a tick. */
  trailing?: ReactNode;
  /** Shown under the field while there is no error. */
  hint?: ReactNode;
}

/** Label, input, and inline error wired together for screen readers. */
export function FormField({
  id,
  label,
  error,
  prefix,
  trailing,
  hint,
  className,
  ...inputProps
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
          >
            {prefix}
          </span>
        )}
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(prefix && 'pl-7', trailing && 'pr-10', className)}
          {...inputProps}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <div id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </div>
        )
      )}
    </div>
  );
}
