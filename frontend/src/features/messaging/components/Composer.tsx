import { MESSAGE_MAX_LENGTH } from '@wumboo/shared';
import { SendIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSendMessage } from '../queries';

/** One line and a send button. Enter sends; a failure keeps what was typed. */
export function Composer({ conversationId, to }: { conversationId: string; to?: string }) {
  const [text, setText] = useState('');
  const send = useSendMessage(conversationId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === '') return;
    send.mutate(trimmed, {
      onSuccess: () => setText(''),
      onError: () => toast.error('That did not send. Try again.'),
    });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-stage-ink/15 p-3">
      <Input
        value={text}
        maxLength={MESSAGE_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        aria-label={to ? `Message ${to}` : 'Message'}
        placeholder="Write a message"
        autoComplete="off"
      />
      <Button type="submit" disabled={send.isPending || text.trim() === ''} aria-label="Send">
        <SendIcon className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
