/**
 * The Wumbo AI service, which is a separate process in another language. The
 * API does not know what it says or how; it only knows how to reach it.
 */
export interface AssistantReply {
  status: number;
  /** Passed through as it came, so the service owns its own error messages. */
  body: unknown;
  /** Seconds, when the service asked the caller to wait. */
  retryAfterSeconds?: number | undefined;
}

export interface AssistantRequest {
  body: unknown;
  /** One id per browser tab, which is what the service's rate limiter counts. */
  sessionId: string | undefined;
}

export interface AssistantClient {
  ask(request: AssistantRequest): Promise<AssistantReply>;
}
