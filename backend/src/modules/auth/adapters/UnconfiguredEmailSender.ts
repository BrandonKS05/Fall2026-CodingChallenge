/**
 * What sends verification codes in production when nothing is configured to:
 * nothing, loudly.
 *
 * The alternative — writing the code to a log nobody reads while telling the
 * person their code is on its way — is worse than an error. It looks like it
 * worked, so nobody investigates, and the account can never be finished. This
 * fails the sign-up instead, which is at least true.
 */
import { UpstreamError } from '../../../domain/errors/index.js';
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import type { EmailSender } from '../ports/CodeSender.js';

export class UnconfiguredEmailSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.logger.error(
      { subject: message.subject },
      'No email delivery is configured, so no verification code was sent. Set RESEND_API_KEY and EMAIL_FROM together.',
    );
    return Promise.reject(
      new UpstreamError('We cannot send the code just now. Try again shortly.', 503),
    );
  }
}
