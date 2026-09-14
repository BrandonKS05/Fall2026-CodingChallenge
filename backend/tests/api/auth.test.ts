/** Route tests with the real argon2 and jose adapters and an in-memory user repository. */
import { authResponseSchema } from '@trove/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository.js';
import { buildTestApp } from '../helpers/testApp.js';

const account = { email: 'Grace@Example.com', password: 'hopper-1906', displayName: 'Grace' };

function sessionCookie(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  const session = cookies.find((cookie) => cookie.startsWith('trove_session='));
  if (!session) throw new Error('no session cookie in response');
  return session;
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
    const paths = res.body.error.details.map((issue: { path: string[] }) => issue.path.join('.'));
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

  it('serves /me only with a valid session', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    expect(anonymous.status).toBe(401);

    const registered = await request(app).post('/api/auth/register').send(account);
    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(registered));
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(registered.body.user.id);

    const tampered = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'trove_session=not-a-real-token');
    expect(tampered.status).toBe(401);
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
    expect(me.status).toBe(401);
  });
});
