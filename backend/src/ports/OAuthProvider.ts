/** What an identity provider tells us about the person who just signed in. */
export interface OAuthProfile {
  providerId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

/**
 * Strategy for "sign in with X". The auth service only sees profiles;
 * redirects, code exchange, and token verification are the adapter's job.
 */
export interface OAuthProvider {
  readonly name: 'google';
  authorizationUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(params: { code: string; redirectUri: string }): Promise<OAuthProfile>;
}
