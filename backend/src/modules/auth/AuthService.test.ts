import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '@wumboo/shared';
import {
  AuthenticationError,
  ConflictError,
  InvalidOperationError,
} from '../../domain/errors/index.js';
import { AuthService } from './AuthService.js';
import {
  FakePasswordHasher,
  FakeTokenService,
  silentLogger,
} from '../../testing/fakes/fakeAuth.js';
import { InMemoryUserRepository } from '../../testing/fakes/InMemoryUserRepository.js';
import { InMemoryVerificationCodeRepository } from '../../testing/fakes/InMemoryVerificationCodeRepository.js';
import { RecordingCodeSender } from '../../testing/fakes/RecordingCodeSender.js';
import { VerificationService } from './VerificationService.js';

describe('AuthService', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let sender: RecordingCodeSender;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    sender = new RecordingCodeSender();
    service = new AuthService({
      users,
      passwordHasher: hasher,
      tokens: new FakeTokenService(),
      verification: new VerificationService({
        codes: new InMemoryVerificationCodeRepository(),
        hasher,
        email: sender,
        sms: sender,
        logger: silentLogger,
      }),
      logger: silentLogger,
    });
  });

  const credentials = {
    email: 'ada@example.com',
    handle: 'ada',
    password: 'correct horse',
    displayName: 'Ada',
  };

  /** Signing up now takes two steps: claim the address, then prove you can read it. */
  const signUp = async (input = credentials) => {
    await service.register(input);
    return signIn('email', input.email);
  };

  const signIn = async (channel: 'email' | 'phone', target: string, profile = {}) => {
    const outcome = await service.verifyCode({
      channel,
      target,
      code: sender.codeFor(target),
      ...profile,
    });
    if (outcome.status !== 'signed-in') {
      throw new Error(`Expected a session, got ${outcome.status}`);
    }
    return outcome;
  };

  it('registers a user, stores only the hash, and waits for the code before any session', async () => {
    const pending = await service.register(credentials);

    expect(pending).toMatchObject({
      status: 'verification-required',
      channel: 'email',
      target: 'ada@example.com',
    });
    const stored = await users.findByEmail('ada@example.com');
    expect(stored?.passwordHash).toBe('hashed:correct horse');
    // The account exists but is not yet anyone's: no session until the code comes back.
    expect(stored?.emailVerifiedAt).toBeNull();
    expect(sender.codeFor('ada@example.com')).toMatch(/^\d{6}$/);

    const result = await signIn('email', 'ada@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.token).toBe(`token:${result.user.id}`);
    expect((await users.findByEmail('ada@example.com'))?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('refuses the wrong code, and burns one that has been guessed at too often', async () => {
    await service.register(credentials);
    const wrong = () =>
      service.verifyCode({ channel: 'email', target: credentials.email, code: '000000' });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(wrong()).rejects.toBeInstanceOf(AuthenticationError);
    }
    // The fifth wrong guess spends the code, so the right one no longer works either.
    await expect(wrong()).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      service.verifyCode({
        channel: 'email',
        target: credentials.email,
        code: sender.codeFor(credentials.email),
      }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a duplicate email with ConflictError once the first one is proved', async () => {
    await signUp();
    await expect(service.register(credentials)).rejects.toBeInstanceOf(ConflictError);
  });

  it('lets a sign-up nobody finished be finished by whoever can read the address', async () => {
    await service.register(credentials);
    // Submitting the form again is not a taken address; it is the same person.
    await expect(service.register(credentials)).resolves.toMatchObject({
      status: 'verification-required',
    });
    // And it does not send a second code straight away.
    expect(sender.countFor(credentials.email)).toBe(1);
  });

  it('will not let a password alone in while the address is unproved', async () => {
    await service.register(credentials);
    await expect(
      service.login({ email: credentials.email, password: credentials.password }),
    ).resolves.toMatchObject({ status: 'verification-required' });
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    await signUp();
    const ok = await service.login({ email: credentials.email, password: credentials.password });
    expect(ok).toMatchObject({ status: 'signed-in', user: { displayName: 'Ada' } });

    await expect(
      service.login({ email: credentials.email, password: 'nope' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('still runs a hash verification for unknown emails so timing does not leak existence', async () => {
    await expect(
      service.login({ email: 'ghost@example.com', password: 'anything' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(hasher.verifyCalls).toBe(1);
  });

  it('treats a session for a deleted user as unauthenticated', async () => {
    const { user } = await signUp();
    users.delete(user.id);
    await expect(service.getUser(user.id)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('lets a person change their name and bio, and delete their account', async () => {
    const { user } = await signUp();
    const updated = await service.updateProfile(user.id, { bio: 'Collector of quiet kitchens.' });
    expect(updated).toMatchObject({ displayName: 'Ada', bio: 'Collector of quiet kitchens.' });
    expect((await users.findById(user.id))?.bio).toBe('Collector of quiet kitchens.');

    await service.deleteAccount(user.id);
    expect(await users.findById(user.id)).toBeNull();
    await expect(
      service.login({ email: credentials.email, password: credentials.password }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  describe('handles', () => {
    it('keeps handles unique, and refuses one that is taken', async () => {
      await signUp();
      expect((await users.findByHandle('ada'))?.email).toBe('ada@example.com');
      expect(await service.isHandleAvailable('ada')).toBe(false);
      expect(await service.isHandleAvailable('nobody')).toBe(true);

      await expect(
        service.register({
          email: 'other@example.com',
          handle: 'ada',
          password: 'password-123',
          displayName: 'Other',
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('names a Google account after its email, varying it when that is taken', async () => {
      await signUp({ ...credentials, email: 'ada@other.com', handle: 'ada' });

      const arrived = await service.loginWithOAuth({
        providerId: 'g-1',
        email: 'ada@example.com',
        displayName: 'Ada L',
        emailVerified: true,
      });

      expect(arrived.user.handle).toBe('ada2');
    });

    it('lets the first handle change through, then settles for two weeks', async () => {
      const { user } = await signUp();
      expect(user.handleChangedAt).toBeNull();

      const renamed = await service.updateProfile(user.id, { handle: 'ada_l' });
      expect(renamed.handle).toBe('ada_l');
      expect(renamed.handleChangedAt).toBeInstanceOf(Date);

      await expect(service.updateProfile(user.id, { handle: 'ada_x' })).rejects.toBeInstanceOf(
        InvalidOperationError,
      );
      // Re-sending the handle it already has is not a change, so it is never refused.
      await expect(
        service.updateProfile(user.id, { handle: 'ada_l', bio: 'Hello' }),
      ).resolves.toMatchObject({ handle: 'ada_l', bio: 'Hello' });

      // Two weeks and a minute later, it moves again.
      await users.update(user.id, { handleChangedAt: new Date(Date.now() - 15 * 86_400_000) });
      await expect(service.updateProfile(user.id, { handle: 'ada_x' })).resolves.toMatchObject({
        handle: 'ada_x',
      });
    });
  });

  describe('settings', () => {
    it('merges a preference patch into what is stored, leaving the other switches alone', async () => {
      const { user } = await signUp();

      const once = await service.updateProfile(user.id, {
        preferences: { notifications: { itemAdded: false }, mutedTags: ['neon'] },
      });
      expect(once.preferences.notifications).toEqual({
        ...DEFAULT_USER_PREFERENCES.notifications,
        itemAdded: false,
      });

      const twice = await service.updateProfile(user.id, { preferences: { discoverable: false } });
      expect(twice.preferences).toMatchObject({
        notifications: { itemAdded: false, memberAdded: true },
        mutedTags: ['neon'],
        discoverable: false,
        defaultBoardVisibility: 'private',
      });
    });

    it('changes the password, retires the old tokens, and keeps the caller signed in', async () => {
      const { user, token } = await signUp();

      const fresh = await service.changePassword(user.id, {
        currentPassword: credentials.password,
        newPassword: 'a longer secret',
      });

      expect(fresh).not.toBe(token);
      const stored = await users.findById(user.id);
      expect(stored?.passwordHash).toBe('hashed:a longer secret');
      expect(stored?.sessionVersion).toBe(1);
      await expect(
        service.login({ email: credentials.email, password: 'a longer secret' }),
      ).resolves.toMatchObject({ user: { id: user.id } });
    });

    it('refuses a password change without the current password, or on a Google account', async () => {
      const { user } = await signUp();
      await expect(
        service.changePassword(user.id, { currentPassword: 'wrong', newPassword: 'another one' }),
      ).rejects.toBeInstanceOf(AuthenticationError);
      expect((await users.findById(user.id))?.sessionVersion).toBe(0);

      const google = await service.loginWithOAuth({
        providerId: 'g-1',
        email: 'grace@example.com',
        displayName: 'Grace',
        emailVerified: true,
      });
      await expect(
        service.changePassword(google.user.id, {
          currentPassword: 'anything',
          newPassword: 'another one',
        }),
      ).rejects.toBeInstanceOf(InvalidOperationError);
    });

    it('revoking sessions raises the version, so an older token no longer matches', async () => {
      const { user } = await signUp();
      const revoked = await service.revokeOtherSessions(user.id);
      expect(revoked).toBe(`token:${user.id}.1`);
      expect((await users.findById(user.id))?.sessionVersion).toBe(1);
    });
  });
});

describe('AuthService with Google', () => {
  let users: InMemoryUserRepository;
  let service: AuthService;
  const profile = {
    providerId: 'g-1',
    email: 'ada@example.com',
    emailVerified: true,
    displayName: 'Ada',
  };

  let sender: RecordingCodeSender;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    sender = new RecordingCodeSender();
    const hasher = new FakePasswordHasher();
    service = new AuthService({
      users,
      passwordHasher: hasher,
      tokens: new FakeTokenService(),
      verification: new VerificationService({
        codes: new InMemoryVerificationCodeRepository(),
        hasher,
        email: sender,
        sms: sender,
        logger: silentLogger,
      }),
      logger: silentLogger,
    });
  });

  it('creates a password-less account on first Google sign-in and reuses it afterwards', async () => {
    const first = await service.loginWithOAuth(profile);
    expect(first.user.email).toBe('ada@example.com');
    expect((await users.findById(first.user.id))?.passwordHash).toBeNull();

    const second = await service.loginWithOAuth({ ...profile, email: 'changed@example.com' });
    expect(second.user.id).toBe(first.user.id);
  });

  it('links Google to an existing password account with the same verified email', async () => {
    await service.register({
      email: 'ada@example.com',
      handle: 'reg',
      password: 'correct horse',
      displayName: 'Ada',
    });
    const registered = await users.findByEmail('ada@example.com');
    const viaGoogle = await service.loginWithOAuth(profile);
    expect(viaGoogle.user.id).toBe(registered?.id);
    expect((await users.findById(viaGoogle.user.id))?.googleId).toBe('g-1');
    // The password still works after linking.
    await expect(
      service.login({ email: 'ada@example.com', password: 'correct horse' }),
    ).resolves.toBeDefined();
  });

  it('refuses unverified emails and password logins to Google-only accounts', async () => {
    await expect(
      service.loginWithOAuth({ ...profile, emailVerified: false }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await service.loginWithOAuth(profile);
    await expect(service.login({ email: 'ada@example.com', password: 'anything' })).rejects.toThrow(
      /signs in with Google/,
    );
    await expect(
      service.register({
        email: 'ada@example.com',
        handle: 'dup',
        password: 'password-123',
        displayName: 'Dup',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
