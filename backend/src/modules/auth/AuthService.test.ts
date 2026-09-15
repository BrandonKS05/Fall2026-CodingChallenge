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

describe('AuthService', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    service = new AuthService({
      users,
      passwordHasher: hasher,
      tokens: new FakeTokenService(),
      logger: silentLogger,
    });
  });

  const credentials = { email: 'ada@example.com', password: 'correct horse', displayName: 'Ada' };

  it('registers a user, stores only the hash, and starts a session', async () => {
    const result = await service.register(credentials);

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.email).toBe('ada@example.com');
    expect(result.token).toBe(`token:${result.user.id}`);
    const stored = await users.findByEmail('ada@example.com');
    expect(stored?.passwordHash).toBe('hashed:correct horse');
  });

  it('rejects a duplicate email with ConflictError', async () => {
    await service.register(credentials);
    await expect(service.register(credentials)).rejects.toBeInstanceOf(ConflictError);
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    await service.register(credentials);
    const ok = await service.login({ email: credentials.email, password: credentials.password });
    expect(ok.user.displayName).toBe('Ada');

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
    const { user } = await service.register(credentials);
    users.delete(user.id);
    await expect(service.getUser(user.id)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('lets a person change their name and bio, and delete their account', async () => {
    const { user } = await service.register(credentials);
    const updated = await service.updateProfile(user.id, { bio: 'Collector of quiet kitchens.' });
    expect(updated).toMatchObject({ displayName: 'Ada', bio: 'Collector of quiet kitchens.' });
    expect((await users.findById(user.id))?.bio).toBe('Collector of quiet kitchens.');

    await service.deleteAccount(user.id);
    expect(await users.findById(user.id)).toBeNull();
    await expect(
      service.login({ email: credentials.email, password: credentials.password }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  describe('settings', () => {
    it('merges a preference patch into what is stored, leaving the other switches alone', async () => {
      const { user } = await service.register(credentials);

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
      const { user, token } = await service.register(credentials);

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
      const { user } = await service.register(credentials);
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
      const { user } = await service.register(credentials);
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

  beforeEach(() => {
    users = new InMemoryUserRepository();
    service = new AuthService({
      users,
      passwordHasher: new FakePasswordHasher(),
      tokens: new FakeTokenService(),
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
    const registered = await service.register({
      email: 'ada@example.com',
      password: 'correct horse',
      displayName: 'Ada',
    });
    const viaGoogle = await service.loginWithOAuth(profile);
    expect(viaGoogle.user.id).toBe(registered.user.id);
    expect((await users.findById(registered.user.id))?.googleId).toBe('g-1');
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
      service.register({ email: 'ada@example.com', password: 'password-123', displayName: 'Dup' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
