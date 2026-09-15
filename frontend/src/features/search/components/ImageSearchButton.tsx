import { ImagePlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { readImage } from '../imageColors';
import type { SearchFilters } from '../filters';

/**
 * Search by a picture you already have. The file is read in the browser and
 * turned into the two things the library can actually match on — its colour and
 * its shape — which the button then says out loud rather than implying magic.
 */
export function ImageSearchButton({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const { hex, orientation } = await readImage(file);
      onChange({ ...filters, colorHex: hex, color: undefined, orientation });
      const shape =
        orientation === 'horizontal' ? 'landscape' : orientation === 'vertical' ? 'portrait' : '';
      toast.success('Matching your picture', {
        description: `Showing ${shape} images around ${hex}. Add a word to narrow it down.`.replace(
          '  ',
          ' ',
        ),
      });
    } catch {
      toast.error('Could not read that image. Try a JPEG or PNG.');
    } finally {
      setReading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Search using an image"
              disabled={reading}
              onClick={() => input.current?.click()}
            />
          }
        >
          <ImagePlusIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Search by a picture&rsquo;s colour and shape</TooltipContent>
      </Tooltip>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void handle(event.target.files?.[0])}
      />
    </>
  );
}
