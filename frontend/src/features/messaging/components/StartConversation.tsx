import { handleSchema } from '@wumboo/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useStartConversation } from '../queries';

/** A handle is the way to reach someone, so that is the whole form. */
export function StartConversation() {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const start = useStartConversation();
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) {
      setError('Handles are 3-24 letters, numbers, and underscores.');
      return;
    }
    setError(null);
    start.mutate(parsed.data, {
      onSuccess: (conversation) => {
        setHandle('');
        void navigate(`/messages/${conversation.id}`);
      },
      onError: (failure) => {
        setError(
          failure instanceof ApiError && failure.status === 404
            ? `Nobody here goes by @${parsed.data}.`
            : failure instanceof ApiError
              ? failure.message
              : 'Could not open that conversation.',
        );
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <FormField
        id="message-handle"
        label="New message"
        prefix="@"
        placeholder="handle"
        autoCapitalize="off"
        spellCheck={false}
        value={handle}
        error={error ?? undefined}
        onChange={(event) => setHandle(event.target.value)}
        className="h-9"
      />
      <Button type="submit" variant="outline" className="h-9" disabled={start.isPending}>
        Write
      </Button>
    </form>
  );
}
