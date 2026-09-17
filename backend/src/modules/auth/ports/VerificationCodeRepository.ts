import type {
  VerificationChannel,
  VerificationCode,
} from '../../../domain/entities/Verification.js';

export interface NewVerificationCode {
  channel: VerificationChannel;
  target: string;
  codeHash: string;
  expiresAt: Date;
}

export interface VerificationCodeRepository {
  create(input: NewVerificationCode): Promise<VerificationCode>;
  /** The newest code for this target that has not been used or expired. */
  findActive(channel: VerificationChannel, target: string): Promise<VerificationCode | null>;
  /** When a code was last sent here, so a resend can be made to wait. */
  lastIssuedAt(channel: VerificationChannel, target: string): Promise<Date | null>;
  /** How many have been sent here since a moment, so nobody can be mailed all day. */
  countSince(channel: VerificationChannel, target: string, since: Date): Promise<number>;
  /** Records a wrong guess and answers how many there have now been. */
  recordAttempt(id: string): Promise<number>;
  /** Spends the code: it can never be presented again. */
  consume(id: string): Promise<void>;
}
