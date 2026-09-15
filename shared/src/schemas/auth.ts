/**
 * Authentication contract: register, login, and the public shape of a user.
 * Password hashes never appear in any schema here.
 */
import { z } from 'zod';
import { atLeastOneField, idSchema, timestampSchema } from './common.js';
import { userPreferencesPatchSchema, userPreferencesSchema } from './preferences.js';

/** Normalizes before validating so " Foo@Bar.com " and "foo@bar.com" are the same account. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);

export const displayNameSchema = z.string().trim().min(1).max(50);

export const registerRequestSchema = z.object({
  email: emailSchema,
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
  displayName: z.string(),
  /** Shown on the person's page; empty until they write one. */
  bio: z.string(),
  /** The person's own settings; only ever sent to the person they belong to. */
  preferences: userPreferencesSchema,
  createdAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** GET /auth/me: a visitor is a normal answer, not an error, so `user` is null rather than a 401. */
export const sessionResponseSchema = z.object({
  user: userSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** Which sign-in methods the server has configured, so the client shows only working buttons. */
export const authProvidersResponseSchema = z.object({
  google: z.boolean(),
});
export type AuthProvidersResponse = z.infer<typeof authProvidersResponseSchema>;
