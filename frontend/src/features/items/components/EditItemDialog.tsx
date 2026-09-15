import { imageTitle, type Collection, type Item } from '@wumboo/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { parseTags } from '@/lib/format';
import { useUpdateItem } from '../queries';

interface EditItemDialogProps {
  collectionId: string;
  item: Item | null;
  /** Boards the user may move the item to (edit rights, not this one). */
  destinations: Collection[];
  onClose: () => void;
}

const STAY = '__stay__';

export function EditItemDialog({ collectionId, item, destinations, onClose }: EditItemDialogProps) {
  const update = useUpdateItem(collectionId);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [target, setTarget] = useState(STAY);

  // Reset the fields when a different item opens. Adjusting state during render is React's
  // documented pattern for this; an effect would render the stale values first.
  const [openedItemId, setOpenedItemId] = useState<string | null>(null);
  if (item && item.id !== openedItemId) {
    setOpenedItemId(item.id);
    setCaption(item.caption);
    setTags(item.tags.join(', '));
    setTarget(STAY);
  }

  const options = [
    { value: STAY, label: 'Keep it on this board' },
    ...destinations.map((board) => ({ value: board.id, label: board.title })),
  ];

  function submit() {
    if (!item) return;
    const moving = target !== STAY;
    update.mutate(
      {
        itemId: item.id,
        patch: {
          caption: caption.trim(),
          tags: parseTags(tags),
          ...(moving && { collectionId: target }),
        },
      },
      {
        onSuccess: () => {
          toast.success(moving ? 'Moved to the other board' : 'Saved');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
          <DialogDescription>Captions and tags make it findable later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-caption">Caption</Label>
            <Textarea
              id="item-caption"
              rows={2}
              placeholder={item ? imageTitle(item.image.tags) : ''}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-tags">Tags</Label>
            <Input
              id="item-tags"
              placeholder="wood, warm, kitchen"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separate with commas.</p>
          </div>
          {destinations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="item-move">Move to</Label>
              <Select
                items={options}
                value={target}
                onValueChange={(value) => setTarget(String(value ?? STAY))}
              >
                <SelectTrigger id="item-move" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="w-full" onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
