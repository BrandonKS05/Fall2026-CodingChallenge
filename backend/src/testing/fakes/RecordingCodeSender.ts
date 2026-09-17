import type { EmailSender, SmsSender } from '../../modules/auth/ports/CodeSender.js';

/**
 * Stands in for the mail and the phone network. A test reads the code the same
 * way a person would — out of the message that was sent — rather than out of
 * the database, where only a hash of it exists.
 */
export class RecordingCodeSender implements EmailSender, SmsSender {
  readonly sent: { to: string; text: string }[] = [];

  async send(message: { to: string; subject?: string; text?: string; body?: string }) {
    this.sent.push({ to: message.to, text: message.text ?? message.body ?? '' });
  }

  /** The code in the last message sent to this address or number. */
  codeFor(to: string): string {
    const last = this.sent.filter((message) => message.to === to).at(-1);
    return /\b(\d{6})\b/.exec(last?.text ?? '')?.[1] ?? '';
  }

  countFor(to: string): number {
    return this.sent.filter((message) => message.to === to).length;
  }
}
