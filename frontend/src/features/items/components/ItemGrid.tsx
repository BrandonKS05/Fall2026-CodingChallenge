import type { Item } from '@trove/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemCard } from './ItemCard';

interface ItemGridProps {
  items: Item[];
  canEdit: boolean;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onRemove: (item: Item) => void;
}

/** CSS columns give a true masonry with no measuring and no layout library. */
export function ItemGrid({ items, ...handlers }: ItemGridProps) {
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} {...handlers} />
      ))}
    </div>
  );
}

export function ItemGridSkeleton() {
  const heights = ['h-40', 'h-64', 'h-52', 'h-72', 'h-44', 'h-60', 'h-48', 'h-56'];
  return (
    <div
      className="columns-2 gap-4 sm:columns-3 lg:columns-4"
      aria-busy
      aria-label="Loading images"
    >
      {heights.map((height, index) => (
        <Skeleton key={index} className={`mb-4 w-full break-inside-avoid rounded-xl ${height}`} />
      ))}
    </div>
  );
}
