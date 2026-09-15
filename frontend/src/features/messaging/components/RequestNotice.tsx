import { ShieldAlertIcon } from 'lucide-react';
import { StageButton } from '@/components/common/StageButton';
import { useAcceptConversation } from '../queries';

/**
 * What a request looks like from the inside: a plain warning, and the one
 * button that changes anything. Until it is pressed the composer is not shown
 * at all, because the server would refuse the message anyway.
 */
export function RequestNotice({
  conversationId,
  from,
  onAccepted,
}: {
  conversationId: string;
  from?: string;
  /** Accepting moves the conversation to the other box; the page follows it there. */
  onAccepted: () => void;
}) {
  const accept = useAcceptConversation();

  return (
    <div className="border-t border-stage-ink/15 p-4">
      <div className="flex gap-3">
        <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-400/80" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {from ? `${from} is not someone you follow.` : 'This message is from a stranger.'}
          </p>
          <p className="mt-1 text-sm text-stage-ink/60">
            They can send one message until you accept. Take a look before you do — accepting lets
            them write to you freely.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <StageButton
          disabled={accept.isPending}
          onClick={() => accept.mutate(conversationId, { onSuccess: onAccepted })}
        >
          {accept.isPending ? 'Accepting…' : 'Accept message'}
        </StageButton>
      </div>
    </div>
  );
}
