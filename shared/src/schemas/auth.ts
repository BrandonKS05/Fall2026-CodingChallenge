/**
 * Authentication contract: register, login, and the public shape of a user.
 * Password hashes never appear in any schema here.
 */
import { z } from 'zod';
import { atLeastOneField, idSchema, timestampSchema } from './common.js';
import { userPreferencesPatchSchema, userPreferencesSchema } from './preferences.js';

/** Normalizes before validating so " Foo@Bar.com " and "foo@bar.com" are the same account. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/**
 * Length does most of the work; the letter-and-number rule rules out the
 * obvious "aaaaaaaaaa". The same rule guards registration and password changes,
 * and the sign-in schema stays loose so older accounts can still get in.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((value) => /[a-zA-Z]/.test(value), 'Include at least one letter')
  .refine((value) => /[0-9]/.test(value), 'Include at least one number');

/** Paths the router owns, so a handle can never shadow a page. */
const RESERVED_HANDLES = new Set([
  'about',
  'admin',
  'api',
  'auth',
  'board',
  'boards',
  'discover',
  'explore',
  'help',
  'home',
  'login',
  'logout',
  'me',
  'new',
  'notifications',
  'privacy',
  'register',
  'root',
  's',
  'search',
  'settings',
  'shared',
  'signin',
  'signup',
  'support',
  'terms',
  'user',
  'users',
  'wumboo',
  'you',
]);

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 24;
/** How long a handle stays put after a change, so people stay findable. */
export const HANDLE_CHANGE_INTERVAL_DAYS = 14;

/**
 * The name people are found by: lowercase, unique, and slow to change. A typed
 * or pasted leading "@" is dropped, so "@ada" and "ada" are the same handle.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^@+/, ''))
  .pipe(
    z
      .string()
      .min(HANDLE_MIN_LENGTH, `Handles are at least ${HANDLE_MIN_LENGTH} characters`)
      .max(HANDLE_MAX_LENGTH, `Handles are at most ${HANDLE_MAX_LENGTH} characters`)
      .regex(
        /^[a-z0-9][a-z0-9_]*$/,
        'Letters, numbers, and underscores only, starting with a letter or number',
      )
      .refine((handle) => !RESERVED_HANDLES.has(handle), 'That handle is spoken for'),
  );

/**
 * A usable handle from an email or a name. Suggests one under the sign-up field,
 * and names the accounts that arrive from Google without choosing one.
 */
export function handleFromSeed(seed: string): string {
  const stem = (seed.split('@')[0] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+/, '')
    .slice(0, HANDLE_MAX_LENGTH - 2);
  const candidate = stem.length > 0 ? stem : 'friend';
  const padded = candidate.padEnd(HANDLE_MIN_LENGTH, '1');
  return RESERVED_HANDLES.has(padded) ? `${padded}1` : padded;
}

/** When a handle last changed at `changedAt` may change again; null if it never has. */
export function nextHandleChangeAt(changedAt: Date | string | null): Date | null {
  if (changedAt === null) return null;
  const changed = changedAt instanceof Date ? changedAt : new Date(changedAt);
  return new Date(changed.getTime() + HANDLE_CHANGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
}

export const displayNameSchema = z.string().trim().min(1).max(50);

export const registerRequestSchema = z.object({
  email: emailSchema,
  handle: handleSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const bioSchema = z.string().trim().max(160);

/** PATCH /auth/me: any subset of what a person may change about themselves, but not nothing. */
export const updateProfileRequestSchema = z
  .object({
    displayName: displayNameSchema,
    handle: handleSchema,
    bio: bioSchema,
    preferences: userPreferencesPatchSchema,
  })
  .partial()
  .refine(atLeastOneField, { error: 'At least one field must be provided' });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** POST /auth/me/password: proving the current password is what authorizes the change. */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/** The authenticated user's own profile. */
export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  /** When the address was proved by a code. Null while it is only claimed. */
  emailVerifiedAt: timestampSchema.nullable(),
  displayName: z.string(),
  /** Unique and lowercase; how other people find this account. */
  handle: z.string(),
  /** When the handle last changed, so the client can say when it may change again. */
  handleChangedAt: timestampSchema.nullable(),
  /** Shown on the person's page; empty until they write one. */
  bio: z.string(),
  /**
   * When they were taken through the one-time interests step. Null while it is
   * still owed, which is what puts it on screen.
   */
  onboardedAt: timestampSchema.nullable(),
  /** The person's own settings; only ever sent to the person they belong to. */
  preferences: userPreferencesSchema,
  createdAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

/** Six digits, and only six digits: spaces people paste in are theirs to make. */
export const verificationCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'The code is six digits'));

/** POST /auth/code: another copy of the code, for an address that has not been proved yet. */
export const sendCodeRequestSchema = z.object({ email: emailSchema });
export type SendCodeRequest = z.infer<typeof sendCodeRequestSchema>;

/** POST /auth/verify: the code, typed back, which is what opens the account. */
export const verifyCodeRequestSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
});
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>;

/**
 * What came of an attempt to get in: a session, or a code waiting to be typed
 * back. One shape for register, login, verify and code, so the client switches
 * on `status` rather than guessing from the body.
 */
export const authOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('signed-in'), user: userSchema }),
  z.object({
    status: z.literal('verification-required'),
    /** The address the code went to, so the client can say it out loud. */
    target: z.email(),
    resendAfterSeconds: z.number().int().nonnegative(),
    /**
     * Only in development, and only while no mail service is configured: the
     * code itself, so a local sign-up can be finished without a mailbox. It is
     * absent in production, where the code is only ever in the message.
     */
    devCode: z.string().optional(),
  }),
]);
export type AuthOutcome = z.infer<typeof authOutcomeSchema>;

/** GET /auth/me: a visitor is a normal answer, not an error, so `user` is null rather than a 401. */
export const sessionResponseSchema = z.object({
  user: userSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** GET /auth/handle-available: one lookup behind the sign-up field. */
export const handleAvailabilityQuerySchema = z.object({ handle: handleSchema });
export type HandleAvailabilityQuery = z.infer<typeof handleAvailabilityQuerySchema>;

export const handleAvailabilityResponseSchema = z.object({
  handle: z.string(),
  available: z.boolean(),
});
export type HandleAvailabilityResponse = z.infer<typeof handleAvailabilityResponseSchema>;

/** Which sign-in methods the server has configured, so the client shows only working buttons. */
export const authProvidersResponseSchema = z.object({
  google: z.boolean(),
});
export type AuthProvidersResponse = z.infer<typeof authProvidersResponseSchema>;
