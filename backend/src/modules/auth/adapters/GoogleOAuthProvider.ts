/**
 * Google sign-in (OpenID Connect, authorization-code flow). The ID token is
 * verified against Google's published keys, so the profile we trust comes
 * from a signed token, not from an unauthenticated userinfo call.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { AuthenticationError, UpstreamError } from '../../../domain/errors/index.js';
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { OAuthProfile, OAuthProvider } from '../ports/OAuthProvider.js';

const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const tokenResponseSchema = z.object({ id_token: z.string() });

const idTokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});
export type IdTokenClaims = z.infer<typeof idTokenClaimsSchema>;

export interface GoogleOAuthOptions {
  clientId: string;
  clientSecret: string;
  fetchFn?: FetchFn;
  /** Test seam: replaces signature verification against Google's JWKS. */
  verifyIdToken?: (idToken: string) => Promise<IdTokenClaims>;
  timeoutMs?: number;
}

export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = 'google' as const;
  private readonly jwks = createRemoteJWKSet(new URL(JWKS_URL));

  constructor(private readonly options: GoogleOAuthOptions) {}

  authorizationUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL(AUTHORIZATION_URL);
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<OAuthProfile> {
    const fetchFn = this.options.fetchFn ?? fetch;
    let response: Response;
    try {
      response = await fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch {
      throw new UpstreamError('Could not reach Google to finish signing in');
    }
    if (!response.ok) throw new AuthenticationError('Google did not accept the sign-in code');

    const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new UpstreamError('Unexpected response from Google');

    const claims = await this.verify(parsed.data.id_token);
    const email = claims.email.trim().toLowerCase();
    return {
      providerId: claims.sub,
      email,
      emailVerified: claims.email_verified === true,
      displayName: claims.name?.trim() || (email.split('@')[0] ?? email),
    };
  }

  private async verify(idToken: string): Promise<IdTokenClaims> {
    if (this.options.verifyIdToken) return this.options.verifyIdToken(idToken);
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: ISSUERS,
        audience: this.options.clientId,
      });
      return idTokenClaimsSchema.parse(payload);
    } catch {
      throw new AuthenticationError('Google returned a token we could not verify');
    }
  }
}
