/**
 * Picks how verification codes leave the building.
 *
 * Both settings present is real email. Neither is the log, which is how a
 * fresh clone signs up with no mail service. One without the other is a
 * misconfiguration — but of sign-up, not of the product, so it is shouted
 * about rather than fatal: an address nobody pasted should not take the whole
 * API down with it.
 */
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import type { EmailSender } from '../ports/CodeSender.js';
import { LoggingCodeSender } from './LoggingCodeSender.js';
import { ResendEmailSender } from './ResendEmailSender.js';

export interface EmailSenderSettings {
  RESEND_API_KEY?: string | undefined;
  EMAIL_FROM?: string | undefined;
}

/** A variable a host left blank is a variable nobody set. */
function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function createEmailSender(
  settings: EmailSenderSettings,
  fetchFn: FetchFn,
  logger: Logger,
): EmailSender {
  const apiKey = filled(settings.RESEND_API_KEY);
  const from = filled(settings.EMAIL_FROM);

  if (apiKey && from) return new ResendEmailSender({ apiKey, from, fetchFn });

  if (apiKey || from) {
    const missing = apiKey ? 'EMAIL_FROM' : 'RESEND_API_KEY';
    const present = apiKey ? 'RESEND_API_KEY' : 'EMAIL_FROM';
    logger.error(
      { missing, present },
      `${present} is set but ${missing} is not, so no verification email can be sent. ` +
        'Set both, or neither. Codes are going to the log until then.',
    );
  }
  return new LoggingCodeSender(logger);
}
