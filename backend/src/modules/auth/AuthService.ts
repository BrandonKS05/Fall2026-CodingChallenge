/**
 * Registration, login, and session lookup. Depends only on ports, so it can
 * be tested with in-memory fakes and reused by any transport.
 */
import { randomUUID } from 'node:crypto';
import { CODE_RESEND_SECONDS } from '../../domain/entities/Verification.js';
import { mergePreferences, nextHandleChangeAt, type UserPreferencesPatch } from '@wumboo/shared';
import { toPublicUser, type PublicUser, type User } from '../../domain/entities/User.js';
import {
  AuthenticationError,
  ConflictError,
  InvalidOperationError,
  RateLimitError,
} from '../../domain/errors/index.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { OAuthProfile } from './ports/OAuthProvider.js';
import type { PasswordHasher } from './ports/PasswordHasher.js';
import type { UserPatch, UserRepository } from './ports/UserRepository.js';
import type { VerificationService } from './VerificationService.js';
import type { TokenService } from './ports/TokenService.js';

export interface AuthServiceDeps {
  users: UserRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenService;
  verification: VerificationService;
  logger: Logger;
}

export interface RegisterInput {
  email: string;
  handle: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** What a person may change about themselves in one request. */
export interface ProfilePatch {
  displayName?: string | undefined;
  handle?: string | undefined;
  bio?: string | undefined;
  preferences?: UserPreferencesPatch | undefined;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

/**
 * What came of an attempt to get in: a session, a code waiting to be typed
 * back, or — for a phone number nobody has used — a request for the name the
 * account will carry. The transport turns these into one response shape.
 */
export type AuthOutcome =
  | ({ status: 'signed-in' } & AuthResult)
  | {
      status: 'verification-required';
      target: string;
      resendAfterSeconds: number;
      /** Development only, and only with no mail service: the code itself. */
      devCode?: string;
    };

export interface VerifyInput {
  target: string;
  code: string;
}

export class AuthService {
  private readonly log: Logger;
  private decoyHash: Promise<string> | undefined;

  constructor(private readonly deps: AuthServiceDeps) {
    this.log = deps.logger.child({ service: 'AuthService' });
  }

  /**
   * Registering claims an address; it does not prove one. The account exists
   * straight away — so the handle and the email are reserved — but it carries
   * no session until a code sent to that address is typed back.
   */
  async register(input: RegisterInput): Promise<AuthOutcome> {
    // Friendly fast path. The unique constraint in the repository is the real guarantee under races.
    const existing = await this.deps.users.findByEmail(input.email);
    if (existing) {
      // An address claimed but never proved is not really taken: whoever can
      // read it can still finish the sign-up, so send them a code instead.
      if (existing.emailVerifiedAt === null && existing.passwordHash !== null) {
        return this.sendCode(input.email, 'finishing your Wumboo sign-up', true);
      }
      throw new ConflictError('An account with this email already exists');
    }
    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const user = await this.deps.users.create({
      email: input.email,
      handle: input.handle,
      displayName: input.displayName,
      passwordHash,
    });
    this.log.info({ userId: user.id }, 'User registered, awaiting verification');
    return this.sendCode(input.email, 'signing up for Wumboo', true);
  }

  /**
   * Sends a code to an address whose sign-up is unfinished. An address with
   * no such account gets nothing, and the answer is the same either way, so
   * this cannot be used to ask whether someone has an account.
   */
  async sendCode(
    target: string,
    purpose = 'signing in to Wumboo',
    /** True when the code was implied rather than asked for, as on sign-up. */
    implied = false,
  ): Promise<AuthOutcome> {
    // An address that is already proved gets no code, and the answer is the
    // same either way, so this cannot be used to ask who has an account.
    const pending = (await this.deps.users.findByEmail(target))?.emailVerifiedAt === null;
    const sent = pending
      ? await this.trySend(target, purpose, implied)
      : { resendAfterSeconds: CODE_RESEND_SECONDS, devCode: undefined };

    return {
      status: 'verification-required',
      target,
      resendAfterSeconds: sent.resendAfterSeconds,
      ...(sent.devCode === undefined ? {} : { devCode: sent.devCode }),
    };
  }

  /**
   * Someone who asked for a code and is asking again too soon should be told
   * so. Someone who submitted the sign-up form twice did not ask twice: the
   * code already in their inbox is the answer, and the wait is all they need.
   */
  private async trySend(
    target: string,
    purpose: string,
    implied: boolean,
  ): Promise<{ resendAfterSeconds: number; devCode?: string | undefined }> {
    try {
      return await this.deps.verification.send('email', target, purpose);
    } catch (error) {
      if (implied && error instanceof RateLimitError) {
        return { resendAfterSeconds: error.retryAfterSeconds };
      }
      throw error;
    }
  }

  /** The code, typed back: what turns a claimed address into an account. */
  async verifyCode(input: VerifyInput): Promise<AuthOutcome> {
    await this.deps.verification.check('email', input.target, input.code);

    const user = await this.deps.users.findByEmail(input.target);
    if (!user) throw new AuthenticationError('That code is not right.');
    const verified =
      user.emailVerifiedAt === null
        ? await this.deps.users.markVerified(user.id, { emailVerifiedAt: new Date() })
        : user;
    this.log.info({ userId: verified.id }, 'Email verified');
    return { status: 'signed-in', ...(await this.startSession(verified)) };
  }

  /**
   * Name, bio, and settings are the person's own to change; everything else stays
   * as registered. A preference patch merges into what is stored, so a request
   * that flips one switch cannot silently reset the others.
   */
  async updateProfile(userId: string, patch: ProfilePatch): Promise<PublicUser> {
    const { preferences, handle, ...fields } = patch;
    const next: UserPatch = { ...fields };
    const current =
      preferences || handle !== undefined ? await this.requireUser(userId) : undefined;

    if (current && preferences) {
      next.preferences = mergePreferences(current.preferences, preferences);
    }
    if (current && handle !== undefined && handle !== current.handle) {
      const unlocksAt = nextHandleChangeAt(current.handleChangedAt);
      if (unlocksAt && unlocksAt > new Date()) {
        const when = unlocksAt.toLocaleDateString('en-US', { dateStyle: 'long' });
        throw new InvalidOperationError(
          `Handles settle for two weeks. You can change yours again on ${when}.`,
        );
      }
      next.handle = handle;
      next.handleChangedAt = new Date();
    }
    const user = await this.deps.users.update(userId, next);
    this.log.info({ userId }, 'Profile updated');
    return toPublicUser(user);
  }

  /**
   * Changing the password proves it is really you, so it also ends every other
   * session. The caller gets a fresh token and stays signed in where they are.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<string> {
    const user = await this.requireUser(userId);
    if (user.passwordHash === null) {
      throw new InvalidOperationError('This account signs in with Google, so it has no password');
    }
    const valid = await this.deps.passwordHasher.verify(user.passwordHash, input.currentPassword);
    if (!valid) throw new AuthenticationError('That is not your current password');

    await this.deps.users.setPassword(
      userId,
      await this.deps.passwordHasher.hash(input.newPassword),
    );
    this.log.info({ userId }, 'Password changed');
    return this.revokeOtherSessions(userId);
  }

  /** Retires every token issued so far and returns a fresh one for the caller. */
  async revokeOtherSessions(userId: string): Promise<string> {
    const sessionVersion = await this.deps.users.bumpSessionVersion(userId);
    this.log.info({ userId, sessionVersion }, 'Sessions revoked');
    return this.deps.tokens.sign({ userId, sessionVersion });
  }

  /** Removes the account and, through the database's cascades, everything it owned or added. */
  async deleteAccount(userId: string): Promise<void> {
    await this.deps.users.delete(userId);
    this.log.info({ userId }, 'Account deleted');
  }

  async login(input: LoginInput): Promise<AuthOutcome> {
    const user = await this.deps.users.findByEmail(input.email);
    if (user && user.passwordHash === null) {
      throw new AuthenticationError('This account signs in with Google');
    }
    // Verify against a decoy when the email is unknown, so response time does not reveal which emails exist.
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const valid = await this.deps.passwordHasher.verify(hash, input.password);
    if (!user || !valid) throw new AuthenticationError();

    // The password is right, but the address was never proved. Finish that first.
    if (user.email !== null && user.emailVerifiedAt === null) {
      return this.sendCode(user.email, 'signing in to Wumboo', true);
    }
    this.log.info({ userId: user.id }, 'User logged in');
    return { status: 'signed-in', ...(await this.startSession(user)) };
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
      // Google only offers a profile once it has checked the address itself,
      // which is why a Google sign-up is never asked for a code.
      emailVerifiedAt: new Date(),
      displayName: profile.displayName,
      passwordHash: null,
      googleId: profile.providerId,
    });
    this.log.info({ userId: created.id }, 'User registered with Google');
    return this.startSession(created);
  }

  /** One lookup behind the sign-up field, so a taken handle is caught before submitting. */
  async isHandleAvailable(handle: string): Promise<boolean> {
    return (await this.deps.users.findByHandle(handle)) === null;
  }

  /** Resolves the session's user, or throws when the account no longer exists. */
  async getUser(userId: string): Promise<PublicUser> {
    return toPublicUser(await this.requireUser(userId));
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new AuthenticationError('Session user no longer exists');
    return user;
  }

  private async startSession(user: User): Promise<AuthResult> {
    const token = await this.deps.tokens.sign({
      userId: user.id,
      sessionVersion: user.sessionVersion,
    });
    return { user: toPublicUser(user), token };
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.deps.passwordHasher.hash(randomUUID());
    return this.decoyHash;
  }
}
