import type { Item } from '@trove/shared';
import { ExternalLinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { timeAgo } from '@/lib/format';

interface ImageLightboxProps {
  item: Item | null;
  onClose: () => void;
}

export function ImageLightbox({ item, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-3xl">
        {item && (
          <div className="flex flex-col">
            <img
              src={item.image.url}
              alt={item.caption || 'Saved image'}
              width={item.image.width}
              height={item.image.height}
              className="max-h-[70svh] w-full bg-muted object-contain"
            />
            <div className="space-y-2 p-4">
              <DialogTitle className="text-base">{item.caption || 'Untitled'}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Added by {item.addedBy.displayName}</span>
                <span>{timeAgo(item.createdAt)}</span>
                <a
                  href={item.image.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  Photo by {item.image.credit.name} on Pixabay <ExternalLinkIcon className="size-3" />
                </a>
              </DialogDescription>
              {item.tags.length > 0 && (
                <p className="text-xs text-muted-foreground">{item.tags.map((tag) => `#${tag}`).join(' ')}</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
