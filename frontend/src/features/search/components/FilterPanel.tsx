import {
  imageTypeSchema,
  searchCategorySchema,
  searchColorSchema,
  searchOrderSchema,
} from '@wumboo/shared';
import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  effectiveScope,
  SCOPE_LABELS,
  SCOPES,
  type SearchFilters,
} from '../filters';
import { ColorWheel } from './ColorWheel';

/**
 * Every filter behind one button. The row of options used to be spread across
 * the page; there are far more of them now, so they live here and the button
 * carries the count of the ones in use.
 */
export function FilterPanel({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const count = activeFilterCount(filters);
  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  // An @ in the box has already decided; the panel says so rather than arguing.
  const byHandle = effectiveScope(filters) === 'people' && filters.scope !== 'people';

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <SlidersHorizontalIcon className="size-4" />
        Filters
        {count > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {count}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[22rem] max-w-[calc(100vw-2rem)] space-y-5">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold">Filters</p>
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" /> Clear all
            </button>
          )}
        </header>

        <Group label="Looking for">
          <Choices
            options={SCOPES.map((option) => [option, SCOPE_LABELS[option]])}
            value={filters.scope}
            onSelect={(scope) => set({ scope })}
          />
          {byHandle && (
            <p className="mt-2 text-xs text-muted-foreground">
              The @ in front of your words is searching people.
            </p>
          )}
        </Group>

        <Group label="Shape">
          <Choices
            options={[
              ['all', 'Any'],
              ['horizontal', 'Landscape'],
              ['vertical', 'Portrait'],
            ]}
            value={filters.orientation}
            onSelect={(orientation) => set({ orientation })}
          />
        </Group>

        <Group label="Kind">
          <Choices
            options={imageTypeSchema.options.map((option) => [
              option,
              option === 'all' ? 'Any' : capitalize(option),
            ])}
            value={filters.type}
            onSelect={(type) => set({ type })}
          />
        </Group>

        <Group label="Sort by">
          <Choices
            options={searchOrderSchema.options.map((option) => [option, capitalize(option)])}
            value={filters.order}
            onSelect={(order) => set({ order })}
          />
        </Group>

        <Group label="Colour">
          <div className="flex flex-wrap gap-1.5">
            {searchColorSchema.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={option}
                aria-pressed={filters.color === option && !filters.colorHex}
                onClick={() =>
                  set({
                    color: filters.color === option ? undefined : option,
                    colorHex: undefined,
                  })
                }
                className={cn(
                  'size-6 rounded-full border transition-transform hover:scale-110',
                  filters.color === option && !filters.colorHex
                    ? 'border-foreground ring-2 ring-foreground/30'
                    : 'border-border',
                )}
                style={{ background: SWATCH[option] }}
              />
            ))}
          </div>
          <p className="mt-3 mb-2 text-xs text-muted-foreground">
            Or pick one exactly — we match it to the closest colour the library indexes.
          </p>
          <ColorWheel
            value={filters.colorHex}
            onChange={(colorHex) => set({ colorHex, color: undefined })}
          />
        </Group>

        <Group label="Category">
          <select
            aria-label="Category"
            value={filters.category ?? ''}
            onChange={(event) =>
              set({
                category: event.target.value
                  ? (event.target.value as SearchFilters['category'])
                  : undefined,
              })
            }
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Any category</option>
            {searchCategorySchema.options.map((option) => (
              <option key={option} value={option}>
                {capitalize(option)}
              </option>
            ))}
          </select>
        </Group>

        <Group label="Size">
          <Choices
            options={[
              ['0', 'Any'],
              ['1280', 'Large'],
              ['1920', 'Extra large'],
              ['3000', 'Huge'],
            ]}
            value={String(filters.minWidth ?? 0)}
            onSelect={(width) => set({ minWidth: Number(width) || undefined })}
          />
        </Group>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.editorsChoice}
            onChange={(event) => set({ editorsChoice: event.target.checked })}
            className="size-4 accent-current"
          />
          Editor&rsquo;s choice only
        </label>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-xs tracking-wider text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** A row of pills where exactly one is chosen. */
function Choices<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: [T, string][] | readonly (readonly [T, string])[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onSelect(option)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs transition-colors',
            value === option
              ? 'border-foreground bg-foreground text-background'
              : 'border-border hover:bg-accent',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SWATCH: Record<string, string> = {
  grayscale: 'linear-gradient(135deg,#fff,#000)',
  transparent: 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0/8px 8px',
  red: '#e02020',
  orange: '#f07818',
  yellow: '#f0c020',
  green: '#3cb043',
  turquoise: '#18c0b0',
  blue: '#2060e0',
  lilac: '#a878e8',
  pink: '#e858a0',
  white: '#ffffff',
  gray: '#909090',
  black: '#101010',
  brown: '#8a5a2b',
};
