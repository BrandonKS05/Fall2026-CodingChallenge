/**
 * Codes that prove an address or a number belongs to whoever typed it.
 *
 * The code is six digits, lives ten minutes, survives five wrong guesses, and
 * is stored only as a hash — the same treatment as a password, because for ten
 * minutes that is exactly what it is. Nothing here knows about users: it
 * answers one question, "did this person receive what we sent to this target",
 * and leaves what that permits to the caller.
 */
import { randomInt } from 'node:crypto';
import {
  CODE_HOURLY_LIMIT,
  CODE_MAX_ATTEMPTS,
  CODE_RESEND_SECONDS,
  CODE_TTL_MINUTES,
  type VerificationChannel,
} from '../../domain/entities/Verification.js';
import { AuthenticationError, RateLimitError } from '../../domain/errors/index.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { EmailSender, SmsSender } from './ports/CodeSender.js';
import type { PasswordHasher } from './ports/PasswordHasher.js';
import type { VerificationCodeRepository } from './ports/VerificationCodeRepository.js';

export interface VerificationServiceDeps {
  codes: VerificationCodeRepository;
  hasher: PasswordHasher;
  email: EmailSender;
  sms: SmsSender;
  logger: Logger;
}

export interface CodeSent {
  /** Seconds until another code may be asked for, so the client can count down. */
  resendAfterSeconds: number;
}

const digits = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export class VerificationService {
  private readonly log: Logger;

  constructor(private readonly deps: VerificationServiceDeps) {
    this.log = deps.logger.child({ service: 'VerificationService' });
  }

  /**
   * Issues a code and sends it. Two limits stand behind it: one code every
   * thirty seconds, and a handful an hour, so an address cannot be used as a
   * megaphone by someone who does not own it.
   */
  async send(channel: VerificationChannel, target: string, purpose: string): Promise<CodeSent> {
    await this.guardRate(channel, target);

    const code = digits();
    await this.deps.codes.create({
      channel,
      target,
      codeHash: await this.deps.hasher.hash(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    });

    const line = `${code} is your Wumboo code. It works for ${CODE_TTL_MINUTES} minutes.`;
    if (channel === 'email') {
      await this.deps.email.send({
        to: target,
        subject: `${code} is your Wumboo code`,
        text: `${line}\n\nYou are ${purpose}. If that was not you, ignore this message and nothing happens.`,
      });
    } else {
      await this.deps.sms.send({ to: target, body: line });
    }
    // The code itself is never logged: the log is not a place to read it from.
    this.log.info({ channel, purpose }, 'Verification code sent');
    return { resendAfterSeconds: CODE_RESEND_SECONDS };
  }

  /**
   * Spends the code. A wrong one is counted, and once there have been too many
   * the code is burned rather than left to be guessed at leisure.
   */
  async check(
    channel: VerificationChannel,
    target: string,
    code: string,
    /** False while the caller still needs the code for a second step. */
    options: { consume?: boolean } = {},
  ): Promise<void> {
    const active = await this.deps.codes.findActive(channel, target);
    if (!active) throw new AuthenticationError('That code has expired. Ask for another.');

    if (!(await this.deps.hasher.verify(active.codeHash, code))) {
      const attempts = await this.deps.codes.recordAttempt(active.id);
      if (attempts >= CODE_MAX_ATTEMPTS) {
        await this.deps.codes.consume(active.id);
        throw new AuthenticationError('Too many wrong codes. Ask for a new one.');
      }
      throw new AuthenticationError('That code is not right.');
    }

    if (options.consume !== false) await this.deps.codes.consume(active.id);
  }

  private async guardRate(channel: VerificationChannel, target: string): Promise<void> {
    const last = await this.deps.codes.lastIssuedAt(channel, target);
    if (last) {
      const waited = (Date.now() - last.getTime()) / 1000;
      if (waited < CODE_RESEND_SECONDS) {
        throw new RateLimitError(
          'A code was just sent. Give it a moment.',
          Math.ceil(CODE_RESEND_SECONDS - waited),
        );
      }
    }
    const hour = new Date(Date.now() - 60 * 60_000);
    if ((await this.deps.codes.countSince(channel, target, hour)) >= CODE_HOURLY_LIMIT) {
      throw new RateLimitError('Too many codes for now. Try again later.', 60 * 60);
    }
  }
}
