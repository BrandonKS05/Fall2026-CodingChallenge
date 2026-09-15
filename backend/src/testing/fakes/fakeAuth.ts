import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { PasswordHasher } from '../../modules/auth/ports/PasswordHasher.js';
import type { SessionClaims, TokenService } from '../../modules/auth/ports/TokenService.js';

/** Reversible "hash" so unit tests stay fast and readable. */
export class FakePasswordHasher implements PasswordHasher {
  verifyCalls = 0;

  async hash(plainText: string): Promise<string> {
    return `hashed:${plainText}`;
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    this.verifyCalls += 1;
    return hash === `hashed:${plainText}`;
  }
}

/** `token:<id>` for a fresh account, `token:<id>.<version>` once sessions have been revoked. */
export class FakeTokenService implements TokenService {
  async sign({ userId, sessionVersion }: SessionClaims): Promise<string> {
    return sessionVersion === 0 ? `token:${userId}` : `token:${userId}.${sessionVersion}`;
  }

  async verify(token: string): Promise<SessionClaims | null> {
    if (!token.startsWith('token:')) return null;
    const [userId = '', version] = token.slice('token:'.length).split('.');
    return { userId, sessionVersion: version ? Number(version) : 0 };
  }
}

const noop = (): void => {};

export const silentLogger: Logger = {
  fatal: noop,
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
  trace: noop,
  child: () => silentLogger,
};
