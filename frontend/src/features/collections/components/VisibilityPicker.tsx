import { collectionVisibilitySchema, type CollectionVisibility } from '@trove/shared';
import { cn } from '@/lib/utils';
import { VISIBILITY } from './VisibilityBadge';

interface VisibilityPickerProps {
  value: CollectionVisibility;
  onChange: (value: CollectionVisibility) => void;
  disabled?: boolean;
}

/** Three explicit choices beat a dropdown for something people rarely change but must understand. */
export function VisibilityPicker({ value, onChange, disabled }: VisibilityPickerProps) {
  return (
    <div role="radiogroup" aria-label="Visibility" className="grid gap-2">
      {collectionVisibilitySchema.options.map((option) => {
        const { label, description, Icon } = VISIBILITY[option];
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
              'hover:bg-accent disabled:opacity-50',
              selected ? 'border-foreground bg-accent' : 'border-border',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
