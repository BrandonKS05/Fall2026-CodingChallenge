/**
 * Forwards a chat message to the Python service and hands back whatever it
 * said. Deliberately thin: validation, prompting and rate limiting all belong
 * to that service, and duplicating any of it here would mean two places to
 * change and two chances to disagree.
 *
 * It exists at all so the browser talks to one origin. The widget used to call
 * the service directly, which meant a second public host, its own CORS rules,
 * and a build-time URL that was wrong in production.
 */
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import type {
  AssistantClient,
  AssistantReply,
  AssistantRequest,
} from '../ports/AssistantClient.js';

/** Long enough for a model to think, short enough that nobody stares at a spinner. */
const TIMEOUT_MS = 30_000;

export class HttpAssistantClient implements AssistantClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn,
    private readonly logger: Logger,
  ) {}

  async ask(request: AssistantRequest): Promise<AssistantReply> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(request.sessionId ? { 'x-session-id': request.sessionId } : {}),
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
      return {
        status: response.status,
        body: await response.json().catch(() => null),
        retryAfterSeconds: Number.isNaN(retryAfter) ? undefined : retryAfter,
      };
    } catch (error) {
      // Not deployed, asleep, or too slow: the widget says the same thing to
      // the reader either way, so there is nothing to distinguish here.
      this.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Wumbo AI did not answer',
      );
      return { status: 503, body: { detail: 'Wumbo AI is not answering just now.' } };
    }
  }
}
