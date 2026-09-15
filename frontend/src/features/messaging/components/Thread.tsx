import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useConversation } from '../queries';

/** The conversation itself: oldest at the top, newest at the bottom, scrolled to the end. */
export function Thread({
  conversationId,
  viewerId,
}: {
  conversationId: string;
  viewerId: string | undefined;
}) {
  const thread = useConversation(conversationId);
  const messages = thread.data?.messages ?? [];
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  // Jump to the end when the conversation opens or a new line arrives.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [conversationId, lastId]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      {thread.isPending ? (
        <p className="text-sm text-stage-ink/50">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-stage-ink/50">No messages yet. Say hello.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {thread.data?.hasMore && (
            <li className="pb-2 text-center text-xs text-stage-ink/40">
              Older messages are not loaded
            </li>
          )}
          {messages.map((message) => {
            const mine = message.sender.id === viewerId;
            return (
              <li key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <span
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap',
                    mine ? 'bg-stage-ink text-stage' : 'bg-stage-ink/10 text-stage-ink',
                  )}
                >
                  {message.body}
                  <span className="sr-only">
                    {mine ? ' (sent by you)' : ` (sent by ${message.sender.displayName})`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={bottom} />
    </div>
  );
}
