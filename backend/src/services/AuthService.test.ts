import { beforeEach, describe, expect, it } from 'vitest';
import { AuthenticationError, ConflictError } from '../domain/errors/index.js';
import { AuthService } from './AuthService.js';
import { FakePasswordHasher, FakeTokenService, silentLogger } from '../testing/fakes/fakeAuth.js';
import { InMemoryUserRepository } from '../testing/fakes/InMemoryUserRepository.js';

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
});
