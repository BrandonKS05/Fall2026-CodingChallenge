import type { GrantableRole } from '@trove/shared';
import { cn } from '@/lib/utils';

const ROLES: { value: GrantableRole; label: string }[] = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

interface RolePickerProps {
  value: GrantableRole;
  onChange: (role: GrantableRole) => void;
  disabled?: boolean;
  label: string;
}

/** Two roles, two buttons. Editors add and change images; viewers only look. */
export function RolePicker({ value, onChange, disabled, label }: RolePickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border p-0.5">
      {ROLES.map((role) => (
        <button
          key={role.value}
          type="button"
          role="radio"
          aria-checked={value === role.value}
          disabled={disabled}
          onClick={() => onChange(role.value)}
          className={cn(
            'rounded px-2 py-0.5 text-xs transition-colors disabled:opacity-50',
            value === role.value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}
