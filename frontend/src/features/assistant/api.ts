/**
 * The Wumbo AI service runs as its own process, but the browser never talks to
 * it directly: the API forwards /api/chat to it. That keeps this to one origin,
 * so there is no CORS to configure and no service URL baked into the bundle at
 * build time, which is exactly what broke it in production before.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_KEY = 'wumbo-ai:session-id';

/**
 * One id per browser tab, for the service's rate limiter. It is not a
 * credential and identifies nobody: it exists so one tab's budget is its own.
 */
function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    // Private windows and blocked storage: fall back to a per-load id.
    return 'no-storage';
  }
}

export class ChatUnavailableError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super('Wumbo AI is not answering');
    this.name = 'ChatUnavailableError';
  }
}

export async function askWumbo(message: string, history: ChatTurn[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId() },
    body: JSON.stringify({ message, conversation_history: history }),
  });

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    throw new ChatUnavailableError(Number.isFinite(retryAfter) ? retryAfter : undefined);
  }

  const body: unknown = await response.json();
  const reply = (body as { reply?: unknown }).reply;
  if (typeof reply !== 'string') throw new ChatUnavailableError();
  return reply;
}
