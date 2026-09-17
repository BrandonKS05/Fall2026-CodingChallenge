import { ImageUpIcon, Loader2Icon } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useUploadItem } from '../queries';

/** What a file picker will offer, and what the server is willing to store. */
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * A picture of your own on this board. The file goes up as itself — the browser
 * already knows what it is — and the board reloads around it.
 */
export function UploadButton({ collectionId }: { collectionId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadItem(collectionId);

  const send = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('That image is larger than 8 MB. Try a smaller one.');
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast.success('Added to the board');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That did not upload. Try again.');
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <Button variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
        {upload.isPending ? <Loader2Icon className="animate-spin" /> : <ImageUpIcon aria-hidden />}
        {upload.isPending ? 'Uploading…' : 'Upload'}
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        aria-label="Upload an image"
        onChange={(event) => void send(event.target.files?.[0])}
      />
    </>
  );
}
