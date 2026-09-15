export interface SessionClaims {
  userId: string;
  /** The user's session version when the token was issued; a stale one is refused. */
  sessionVersion: number;
}

/** Issues and checks opaque session tokens. Expiry is the adapter's concern. */
export interface TokenService {
  sign(claims: SessionClaims): Promise<string>;
  /** Resolves null for an invalid, expired, or tampered token; never throws. */
  verify(token: string): Promise<SessionClaims | null>;
}
