/**
 * Signing up, the way everything except the auth suite needs it: register,
 * read the code out of the message that was sent, type it back, and hand over
 * the session cookie. Tests about other things should not have to know that
 * an address is proved before it is an account.
 */
import { handleFromSeed } from '@wumboo/shared';
import type { Express } from 'express';
import request from 'supertest';
import { codesOf } from './testApp.js';

export interface TestAccount {
  cookie: string;
  handle: string;
  email: string;
  /** The account itself, for suites that need the id rather than the cookie. */
  id: string;
}

export async function signUpVia(
  app: Express,
  email: string,
  password = 'password-123',
): Promise<TestAccount> {
  const handle = handleFromSeed(email);
  await request(app)
    .post('/api/auth/register')
    .send({ email, handle, password, displayName: email.split('@')[0] });

  const verified = await request(app)
    .post('/api/auth/verify')
    .send({ channel: 'email', email, code: codesOf(app).codeFor(email.toLowerCase()) });

  const header = verified.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return {
    cookie: cookies.find((cookie) => cookie.startsWith('wumboo_session=')) ?? '',
    handle,
    email,
    id: (verified.body as { user?: { id: string } }).user?.id ?? '',
  };
}
