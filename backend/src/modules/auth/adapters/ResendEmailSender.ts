/**
 * Email through Resend's HTTP API — one POST, no SDK. Any provider with a
 * send-one-email endpoint would fit behind the same port; this one is here
 * because it needs a key and nothing else to start sending.
 */
import { UpstreamError } from '../../../domain/errors/index.js';
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { EmailSender } from '../ports/CodeSender.js';

export interface ResendOptions {
  apiKey: string;
  /** The verified sender, e.g. "Wumboo <hello@wumboo.app>". */
  from: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}

export class ResendEmailSender implements EmailSender {
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(private readonly options: ResendOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.resend.com';
  }

  async send(message: { to: string; subject: string; text: string }): Promise<void> {
    const response = await this.fetchFn(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      // The body can carry the address; the status is all that is safe to keep.
      throw new UpstreamError('The email could not be sent', response.status);
    }
  }
}
