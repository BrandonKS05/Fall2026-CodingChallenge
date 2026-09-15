import type { Item } from '@wumboo/shared';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: Item;
  canEdit: boolean;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onRemove: (item: Item) => void;
}

/**
 * A saved image. The box is sized from the image's aspect ratio before the
 * file arrives, so the masonry never jumps, and the dominant color (once
 * extracted) fills the space while it loads.
 */
export function ItemCard({ item, canEdit, onOpen, onEdit, onRemove }: ItemCardProps) {
  const { image } = item;
  const alt = item.caption || image.tags.slice(0, 3).join(', ') || 'Saved image';
  // A cached image can finish before React attaches onLoad, so the ref checks `complete` too.
  const [loaded, setLoaded] = useState(false);

  return (
    <figure className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-muted">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${alt}`}
        style={{ backgroundColor: image.palette[0] }}
      >
        <img
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setLoaded(true);
          }}
          src={image.url}
          alt={alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: `${image.width} / ${image.height}` }}
          className={cn(
            'w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setLoaded(true)}
        />
      </button>

      {canEdit && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Edit item"
                  onClick={() => onEdit(item)}
                />
              }
            >
              <PencilIcon />
            </TooltipTrigger>
            <TooltipContent>Edit caption, tags, or move</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label="Remove item"
                  onClick={() => onRemove(item)}
                />
              }
            >
              <Trash2Icon />
            </TooltipTrigger>
            <TooltipContent>Remove from board</TooltipContent>
          </Tooltip>
        </div>
      )}

      {(item.caption || item.tags.length > 0) && (
        <figcaption className="space-y-1 px-3 py-2">
          {item.caption && <p className="text-sm leading-snug">{item.caption}</p>}
          {item.tags.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              {item.tags.map((tag) => `#${tag}`).join(' ')}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
