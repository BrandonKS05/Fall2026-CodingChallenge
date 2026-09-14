import { describe, expect, it } from 'vitest';
import { AuthenticationError, UpstreamError } from '../../../domain/errors/index.js';
import { createFakeFetch } from '../../../testing/fakes/fakeFetch.js';
import { GoogleOAuthProvider } from './GoogleOAuthProvider.js';

const redirectUri = 'http://localhost:5173/api/auth/google/callback';

describe('GoogleOAuthProvider', () => {
  it('builds the consent URL with the openid scopes and state', () => {
    const provider = new GoogleOAuthProvider({ clientId: 'client', clientSecret: 'secret' });
    const url = new URL(provider.authorizationUrl({ state: 'xyz', redirectUri }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'xyz',
    });
    expect(url.searchParams.has('client_secret')).toBe(false);
  });

  it('exchanges the code with the secret and maps the verified token into a profile', async () => {
    const fetchFn = createFakeFetch({ 'https://oauth2.googleapis.com/token': { body: JSON.stringify({ id_token: 'signed' }) } });
    const provider = new GoogleOAuthProvider({
      clientId: 'client',
      clientSecret: 'secret',
      fetchFn,
      verifyIdToken: async (token) => {
        expect(token).toBe('signed');
        return { sub: 'g-123', email: ' Ada@Example.com ', email_verified: true, name: 'Ada Lovelace' };
      },
    });

    const profile = await provider.exchangeCode({ code: 'the-code', redirectUri });
    expect(profile).toEqual({ providerId: 'g-123', email: 'ada@example.com', emailVerified: true, displayName: 'Ada Lovelace' });
    expect(fetchFn.calls).toEqual(['https://oauth2.googleapis.com/token']);
  });

  it('falls back to the email local part as a name and treats unverified as unverified', async () => {
    const fetchFn = createFakeFetch({ 'https://oauth2.googleapis.com/token': { body: JSON.stringify({ id_token: 't' }) } });
    const provider = new GoogleOAuthProvider({
      clientId: 'c',
      clientSecret: 's',
      fetchFn,
      verifyIdToken: async () => ({ sub: 'g-1', email: 'linus@example.com' }),
    });
    expect(await provider.exchangeCode({ code: 'x', redirectUri })).toMatchObject({ displayName: 'linus', emailVerified: false });
  });

  it('turns a rejected code, garbage, and an unreachable Google into the right errors', async () => {
    const rejected = new GoogleOAuthProvider({ clientId: 'c', clientSecret: 's', fetchFn: createFakeFetch({ '*': { status: 400, body: '{}' } }) });
    await expect(rejected.exchangeCode({ code: 'bad', redirectUri })).rejects.toBeInstanceOf(AuthenticationError);

    const garbage = new GoogleOAuthProvider({ clientId: 'c', clientSecret: 's', fetchFn: createFakeFetch({ '*': { body: 'not json' } }) });
    await expect(garbage.exchangeCode({ code: 'x', redirectUri })).rejects.toBeInstanceOf(UpstreamError);

    const offline = new GoogleOAuthProvider({
      clientId: 'c',
      clientSecret: 's',
      fetchFn: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.exchangeCode({ code: 'x', redirectUri })).rejects.toThrow(/reach Google/);
  });
});
