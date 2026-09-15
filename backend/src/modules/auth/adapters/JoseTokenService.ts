import { SignJWT, jwtVerify } from 'jose';
import type { SessionClaims, TokenService } from '../ports/TokenService.js';

/** Adapter over jose: HS256 JWTs carrying the user id as the subject. */
export class JoseTokenService implements TokenService {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
    private readonly issuer = 'wumboo',
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign({ userId }: SessionClaims): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(this.issuer)
      .setIssuedAt(now)
      .setExpirationTime(now + this.ttlSeconds)
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        audience: this.issuer,
        algorithms: ['HS256'],
      });
      return payload.sub ? { userId: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
