/**
 * A proof-of-contact code: the thing that turns an address someone typed into
 * one they can actually read. The channel column outlives the one channel
 * there is, because the table is the durable part and a second way of
 * reaching someone would not want a new one.
 */
export const VERIFICATION_CHANNELS = ['email', 'phone'] as const;
export type VerificationChannel = (typeof VERIFICATION_CHANNELS)[number];

export interface VerificationCode {
  id: string;
  channel: VerificationChannel;
  /** The address or number, normalized: lowercased email, or E.164. */
  target: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

/** How long a code is good for, how many guesses it survives, and how often one may be asked for. */
export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 30;
/** Codes per target per hour, so nobody can be texted or mailed all day. */
export const CODE_HOURLY_LIMIT = 6;
