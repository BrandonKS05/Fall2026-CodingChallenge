/**
 * The development sender: it writes the message to the log instead of sending
 * it. Nothing is faked — the code is real and the flow is the real flow — the
 * only difference is where the message lands. It is what runs until the
 * delivery credentials are set, so a fresh clone can sign up end to end.
 */
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import type { EmailSender } from '../ports/CodeSender.js';

export class LoggingCodeSender implements EmailSender {
  constructor(private readonly logger: Logger) {}

  async send(message: { to: string; subject: string; text: string }) {
    this.logger.warn(
      { to: message.to, message: message.text },
      'No delivery service configured — the code is in this log line, which is fine in development and never in production',
    );
  }
}
