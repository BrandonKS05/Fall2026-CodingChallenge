/**
 * Wumbo AI: a floating button that opens a chat panel.
 *
 * Self-contained on purpose — it holds its own state, talks to its own service,
 * and uses the app's theme tokens, so dropping `<WumboAI />` on any page is the
 * whole integration. The conversation lives in sessionStorage: it survives a
 * refresh, and it is gone when the tab closes.
 */
import { MessageCircleIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { askWumbo, ChatUnavailableError, type ChatTurn } from '../api';

const STORAGE_KEY = 'wumbo-ai:conversation';
/** Long enough to keep context, short enough that the request stays small. */
const REMEMBERED_TURNS = 20;

interface Bubble extends ChatTurn {
  id: string;
  /** Set when this reply is the widget apologising rather than the model answering. */
  failed?: boolean;
}

function load(): Bubble[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Bubble[]) : [];
  } catch {
    return [];
  }
}

function save(bubbles: Bubble[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bubbles.slice(-REMEMBERED_TURNS)));
  } catch {
    // Storage full or blocked: the conversation just will not survive a refresh.
  }
}

export function WumboAI() {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>(load);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => save(bubbles), [bubbles]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [open, bubbles, thinking]);

  // Escape closes the panel from anywhere inside it.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (question === '' || thinking) return;

    const asked: Bubble = { id: crypto.randomUUID(), role: 'user', content: question };
    // The history the service sees is what was on screen before this question.
    const history = bubbles
      .filter((bubble) => !bubble.failed)
      .map(({ role, content }) => ({ role, content }));
    setBubbles((current) => [...current, asked]);
    setDraft('');
    setThinking(true);

    try {
      const reply = await askWumbo(question, history);
      setBubbles((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } catch (error) {
      const waitFor = error instanceof ChatUnavailableError ? error.retryAfterSeconds : undefined;
      setBubbles((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          failed: true,
          content: waitFor
            ? `That's a lot of questions at once. Try me again in about ${waitFor} seconds.`
            : "I couldn't reach my brain just then. Try asking again in a moment.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-controls="wumbo-ai-panel"
        aria-label={open ? 'Close Wumbo AI' : 'Ask Wumbo AI'}
        className="fixed right-5 bottom-5 z-50 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {open ? <XIcon className="size-6" /> : <MessageCircleIcon className="size-6" />}
      </button>

      {open && (
        <section
          id="wumbo-ai-panel"
          aria-label="Wumbo AI"
          onKeyDown={onKeyDown}
          className="fixed right-5 bottom-24 z-50 flex h-[min(32rem,calc(100svh-8rem))] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <MessageCircleIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Wumbo AI</p>
              <p className="text-xs text-muted-foreground">Here to explain Wumboo</p>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            {bubbles.length === 0 && !thinking ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Ask Wumbo AI anything
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {bubbles.map((bubble) => (
                  <li
                    key={bubble.id}
                    className={cn('flex', bubble.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <span
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap',
                        bubble.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                        bubble.failed && 'text-muted-foreground italic',
                      )}
                    >
                      <span className="sr-only">
                        {bubble.role === 'user' ? 'You said: ' : 'Wumbo AI said: '}
                      </span>
                      {bubble.content}
                    </span>
                  </li>
                ))}
                {thinking && (
                  <li className="flex justify-start">
                    <span
                      className="flex items-center gap-1 rounded-2xl bg-muted px-3.5 py-3"
                      aria-label="Wumbo AI is typing"
                      data-testid="wumbo-typing"
                    >
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          aria-hidden
                          className="size-1.5 animate-bounce rounded-full bg-foreground/40"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </span>
                  </li>
                )}
              </ol>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Wumbo AI anything"
              aria-label="Ask Wumbo AI anything"
              maxLength={2000}
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
            />
            <button
              type="submit"
              disabled={thinking || draft.trim() === ''}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <SendIcon className="size-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
