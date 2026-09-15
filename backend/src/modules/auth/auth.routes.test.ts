/** Route tests with the real argon2 and jose adapters and an in-memory user repository. */
import { authResponseSchema } from '@wumboo/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeOAuthProvider } from '../../testing/fakes/FakeOAuthProvider.js';
import { InMemoryUserRepository } from '../../testing/fakes/InMemoryUserRepository.js';
import { buildTestApp } from '../../testing/testApp.js';

const account = { email: 'Grace@Example.com', password: 'hopper-1906', displayName: 'Grace' };

function sessionCookie(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return cookies.find((cookie) => cookie.startsWith('wumboo_session=')) ?? '';
}

describe('auth routes', () => {
  let app: Express;
  let users: InMemoryUserRepository;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    app = buildTestApp({ repositories: { users } });
  });

  it('registers, sets an httpOnly session cookie, and returns the contract shape', async () => {
    const res = await request(app).post('/api/auth/register').send(account);

    expect(res.status).toBe(201);
    expect(authResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.user.email).toBe('grace@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(account);
    const res = await request(app).post('/api/auth/register').send(account);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid body with field-level details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', displayName: '' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining(['body.email', 'body.password', 'body.displayName']),
    );
  });

  it('logs in with normalized email and rejects a wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send(account);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: '  GRACE@example.com ', password: account.password });
    expect(ok.status).toBe(200);
    expect(ok.body.user.displayName).toBe('Grace');

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'wrong' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('answers /me with the user, or null for anyone without a valid session', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({ user: null });

    const registered = await request(app).post('/api/auth/register').send(account);
    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(registered));
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(registered.body.user.id);

    const tampered = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'wumboo_session=not-a-real-token');
    expect(tampered.body).toEqual({ user: null });
  });

  it('logs out by clearing the cookie', async () => {
    const registered = await request(app).post('/api/auth/register').send(account);
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie(registered));
    expect(logout.status).toBe(204);
    expect(sessionCookie(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('locks out a session whose user was deleted', async () => {
    const registered = await request(app).post('/api/auth/register').send(account);
    users.delete(registered.body.user.id);
    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(registered));
    expect(me.body).toEqual({ user: null });
  });

  it('updates the profile and deletes the account through /me', async () => {
    const registered = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: 'lovelace-1815', displayName: 'Ada' });
    const cookie = sessionCookie(registered);

    expect((await request(app).patch('/api/auth/me').send({ bio: 'x' })).status).toBe(401);
    const patched = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ bio: 'Collector of quiet kitchens.' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ displayName: 'Ada', bio: 'Collector of quiet kitchens.' });
    expect((await request(app).patch('/api/auth/me').set('Cookie', cookie).send({})).status).toBe(
      400,
    );

    const deleted = await request(app).delete('/api/auth/me').set('Cookie', cookie);
    expect(deleted.status).toBe(204);
    expect(String(deleted.headers['set-cookie'])).toMatch(/wumboo_session=;/);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).body.user).toBeNull();
  });

  it('patches preferences without disturbing the rest, and keeps them out of other views', async () => {
    const registered = await request(app).post('/api/auth/register').send(account);
    const cookie = sessionCookie(registered);
    expect(registered.body.user.preferences.notifications.itemAdded).toBe(true);

    const patched = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({
        preferences: { notifications: { memberAdded: false }, mutedTags: ['Neon', 'neon'] },
      });

    expect(patched.status).toBe(200);
    expect(patched.body.preferences).toMatchObject({
      notifications: { memberAdded: false, itemAdded: true },
      mutedTags: ['neon'],
      discoverable: true,
    });

    const rejected = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ preferences: { defaultBoardVisibility: 'everyone' } });
    expect(rejected.status).toBe(400);
  });

  it('changes the password, which signs the other devices out but not this one', async () => {
    const registered = await request(app).post('/api/auth/register').send(account);
    const oldCookie = sessionCookie(registered);

    const wrong = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: 'not-it', newPassword: 'a-longer-secret' });
    expect(wrong.status).toBe(401);

    const changed = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: account.password, newPassword: 'a-longer-secret' });
    expect(changed.status).toBe(204);

    const newCookie = sessionCookie(changed);
    expect(newCookie).not.toBe('');
    // The device that made the change carries on; the cookie it arrived with is dead.
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', newCookie)).body.user,
    ).not.toBeNull();
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).body.user).toBeNull();

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'a-longer-secret' });
    expect(relogin.status).toBe(200);
  });

  it('signs out other sessions on request', async () => {
    const registered = await request(app).post('/api/auth/register').send(account);
    const oldCookie = sessionCookie(registered);

    const revoked = await request(app)
      .post('/api/auth/me/sessions/revoke')
      .set('Cookie', oldCookie);

    expect(revoked.status).toBe(204);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).body.user).toBeNull();
    const kept = sessionCookie(revoked);
    expect((await request(app).get('/api/auth/me').set('Cookie', kept)).body.user).not.toBeNull();
  });
});

describe('Google sign-in routes', () => {
  const profile = {
    providerId: 'g-42',
    email: 'grace@example.com',
    emailVerified: true,
    displayName: 'Grace',
  };

  function buildGoogleApp() {
    const users = new InMemoryUserRepository();
    const google = new FakeOAuthProvider({ 'good-code': profile });
    const app = buildTestApp({ repositories: { users }, oauth: { google } });
    return { app, users, google };
  }

  function stateCookie(res: request.Response): string {
    const header = res.headers['set-cookie'];
    const cookies = Array.isArray(header) ? header : [header ?? ''];
    return cookies.find((cookie) => cookie.startsWith('wumboo_oauth_state=')) ?? '';
  }

  it('advertises configured providers', async () => {
    expect((await request(buildGoogleApp().app).get('/api/auth/providers')).body).toEqual({
      google: true,
    });
    expect((await request(buildTestApp({ oauth: {} })).get('/api/auth/providers')).body).toEqual({
      google: false,
    });
  });

  it('starts by setting a state cookie and redirecting to Google', async () => {
    const { app, google } = buildGoogleApp();
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.test\/auth\?state=/);
    expect(stateCookie(res)).toMatch(/HttpOnly/i);
    expect(google.authorizationCalls[0]?.redirectUri).toBe(
      'http://localhost:5173/api/auth/google/callback',
    );
  });

  it('completes the round trip: valid state and code start a session', async () => {
    const { app, users } = buildGoogleApp();
    const start = await request(app).get('/api/auth/google');
    const state = new URL(start.headers.location ?? '').searchParams.get('state') ?? '';

    const callback = await request(app)
      .get(`/api/auth/google/callback?code=good-code&state=${encodeURIComponent(state)}`)
      .set('Cookie', stateCookie(start));
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:5173/boards');
    expect(sessionCookie(callback)).toMatch(/HttpOnly/i);
    expect(await users.findByGoogleId('g-42')).toMatchObject({
      email: 'grace@example.com',
      passwordHash: null,
    });

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(callback));
    expect(me.body.user.displayName).toBe('Grace');
  });

  it('sends the browser back to login with a reason when the state, code, or consent is wrong', async () => {
    const { app } = buildGoogleApp();
    const start = await request(app).get('/api/auth/google');
    const cookie = stateCookie(start);

    const tampered = await request(app)
      .get('/api/auth/google/callback?code=good-code&state=forged')
      .set('Cookie', cookie);
    expect(tampered.headers.location).toBe('http://localhost:5173/login?error=oauth_state');

    const denied = await request(app)
      .get('/api/auth/google/callback?error=access_denied')
      .set('Cookie', cookie);
    expect(denied.headers.location).toBe('http://localhost:5173/login?error=google_denied');

    const state = new URL(start.headers.location ?? '').searchParams.get('state') ?? '';
    const badCode = await request(app)
      .get(`/api/auth/google/callback?code=nope&state=${state}`)
      .set('Cookie', cookie);
    expect(badCode.headers.location).toBe('http://localhost:5173/login?error=google_failed');
    expect(sessionCookie(badCode)).toBe('');
  });

  it('answers 302 to login when Google is not configured', async () => {
    const res = await request(buildTestApp({ oauth: {} })).get('/api/auth/google');
    expect(res.headers.location).toBe('http://localhost:5173/login?error=google_unavailable');
  });
});
