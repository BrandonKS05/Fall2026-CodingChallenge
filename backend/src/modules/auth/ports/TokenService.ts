export interface SessionClaims {
  userId: string;
}

/** Issues and checks opaque session tokens. Expiry is the adapter's concern. */
export interface TokenService {
  sign(claims: SessionClaims): Promise<string>;
  /** Resolves null for an invalid, expired, or tampered token; never throws. */
  verify(token: string): Promise<SessionClaims | null>;
}
