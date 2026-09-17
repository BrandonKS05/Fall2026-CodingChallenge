/**
 * SMS through Twilio's REST API: form-encoded, basic auth, one request. The
 * account id and token are read from the environment and never logged.
 */
import { UpstreamError } from '../../../domain/errors/index.js';
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { SmsSender } from '../ports/CodeSender.js';

export interface TwilioOptions {
  accountSid: string;
  authToken: string;
  /** The sending number in E.164, or a messaging service SID. */
  from: string;
  fetchFn?: FetchFn;
  baseUrl?: string;
}

export class TwilioSmsSender implements SmsSender {
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(private readonly options: TwilioOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.twilio.com';
  }

  async send(message: { to: string; body: string }): Promise<void> {
    const form = new URLSearchParams({
      To: message.to,
      Body: message.body,
      ...(this.options.from.startsWith('MG')
        ? { MessagingServiceSid: this.options.from }
        : { From: this.options.from }),
    });
    const credentials = Buffer.from(
      `${this.options.accountSid}:${this.options.authToken}`,
    ).toString('base64');

    const response = await this.fetchFn(
      `${this.baseUrl}/2010-04-01/Accounts/${this.options.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${credentials}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );
    if (!response.ok) {
      throw new UpstreamError('The message could not be sent', response.status);
    }
  }
}
