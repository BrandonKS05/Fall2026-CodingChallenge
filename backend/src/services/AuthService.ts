/**
 * Registration, login, and session lookup. Depends only on ports, so it can
 * be tested with in-memory fakes and reused by any transport.
 */
import { randomUUID } from 'node:crypto';
import { toPublicUser, type PublicUser, type User } from '../domain/entities/User.js';
import { AuthenticationError, ConflictError } from '../domain/errors/index.js';
import type { Logger } from '../ports/Logger.js';
import type { OAuthProfile } from '../ports/OAuthProvider.js';
import type { PasswordHasher } from '../ports/PasswordHasher.js';
import type { UserRepository } from '../ports/repositories/UserRepository.js';
import type { TokenService } from '../ports/TokenService.js';

export interface AuthServiceDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  logger: Logger;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export class AuthService {
  private readonly log: Logger;
  private decoyHash: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {
    this.log = deps.logger.child({ service: 'AuthService' });
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    // Friendly fast path. The unique constraint in the repository is the real guarantee under races.
    if (await this.deps.users.findByEmail(input.email)) {
      throw new ConflictError('An account with this email already exists');
    }
    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const user = await this.deps.users.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
    this.log.info({ userId: user.id }, 'User registered');
    return this.startSession(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.deps.users.findByEmail(input.email);
    if (user && user.passwordHash === null) {
      throw new AuthenticationError('This account signs in with Google');
    }
    // Verify against a decoy when the email is unknown, so response time does not reveal which emails exist.
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const valid = await this.deps.passwordHasher.verify(hash, input.password);
    if (!user || !valid) throw new AuthenticationError();
    this.log.info({ userId: user.id }, 'User logged in');
    return this.startSession(user);
  }

  /**
   * Signs in with an identity provider's verified profile. Matches by provider
   * id first, then links by verified email, and otherwise creates the account.
   */
  async loginWithOAuth(profile: OAuthProfile): Promise<AuthResult> {
    if (!profile.emailVerified) {
      throw new AuthenticationError('Google has not verified that email address');
    }
    const byProvider = await this.deps.users.findByGoogleId(profile.providerId);
    if (byProvider) return this.startSession(byProvider);

    const byEmail = await this.deps.users.findByEmail(profile.email);
    if (byEmail) {
      const linked = await this.deps.users.linkGoogle(byEmail.id, profile.providerId);
      this.log.info({ userId: linked.id }, 'Google account linked');
      return this.startSession(linked);
    }

    const created = await this.deps.users.create({
      email: profile.email,
      displayName: profile.displayName,
      passwordHash: null,
      googleId: profile.providerId,
    });
    this.log.info({ userId: created.id }, 'User registered with Google');
    return this.startSession(created);
  }

  /** Resolves the session's user, or throws when the account no longer exists. */
  async getUser(userId: string): Promise<PublicUser> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new AuthenticationError('Session user no longer exists');
    return toPublicUser(user);
  }

  private async startSession(user: User): Promise<AuthResult> {
    const token = await this.deps.tokens.sign({ userId: user.id });
    return { user: toPublicUser(user), token };
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.deps.passwordHasher.hash(randomUUID());
    return this.decoyHash;
  }
}
