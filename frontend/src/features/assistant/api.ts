/**
 * The Wumbo AI service lives outside this app, so it is reached by its own URL
 * rather than through the /api rewrite. Set VITE_WUMBO_AI_URL when it is not on
 * localhost; nothing else about the widget changes.
 */
const BASE_URL = import.meta.env.VITE_WUMBO_AI_URL ?? 'http://localhost:8000';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_KEY = 'wumbo-ai:session-id';

/**
 * One id per browser tab, for the service's rate limiter. It is not a
 * credential and identifies nobody: it exists so one tab's budget is its own.
 */
export function sessionId(): string {
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
  const response = await fetch(`${BASE_URL}/api/chat`, {
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
