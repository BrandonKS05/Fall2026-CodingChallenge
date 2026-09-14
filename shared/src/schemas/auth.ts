/**
 * Authentication contract: register, login, and the public shape of a user.
 * Password hashes never appear in any schema here.
 */
import { z } from 'zod';
import { idSchema, timestampSchema } from './common.js';

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

/** The authenticated user's own profile. */
export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  displayName: z.string(),
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
