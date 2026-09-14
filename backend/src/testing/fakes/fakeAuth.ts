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

export class FakeTokenService implements TokenService {
  async sign({ userId }: SessionClaims): Promise<string> {
    return `token:${userId}`;
  }

  async verify(token: string): Promise<SessionClaims | null> {
    return token.startsWith('token:') ? { userId: token.slice('token:'.length) } : null;
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
