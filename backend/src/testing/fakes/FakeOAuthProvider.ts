import { AuthenticationError } from '../../domain/errors/index.js';
import type { OAuthProfile, OAuthProvider } from '../../modules/auth/ports/OAuthProvider.js';

/** Hands out fixed profiles keyed by code, and records what it was asked. */
export class FakeOAuthProvider implements OAuthProvider {
  readonly name = 'google' as const;
  authorizationCalls: { state: string; redirectUri: string }[] = [];
  exchangeCalls: { code: string; redirectUri: string }[] = [];

  constructor(private readonly profiles: Record<string, OAuthProfile>) {}

  authorizationUrl(params: { state: string; redirectUri: string }): string {
    this.authorizationCalls.push(params);
    return `https://accounts.google.test/auth?state=${encodeURIComponent(params.state)}`;
  }

  async exchangeCode(params: { code: string; redirectUri: string }): Promise<OAuthProfile> {
    this.exchangeCalls.push(params);
    const profile = this.profiles[params.code];
    if (!profile) throw new AuthenticationError('Google did not accept the sign-in code');
    return profile;
  }
}
