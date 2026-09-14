import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../../src/domain/errors/index.js';
import type { Database } from '../../src/infrastructure/db/client.js';
import { DrizzleUserRepository } from '../../src/infrastructure/db/repositories/DrizzleUserRepository.js';
import { connectTestDatabase, RUN_DB_TESTS, truncateAll } from './db.js';

describe.skipIf(!RUN_DB_TESTS)('DrizzleUserRepository (postgres)', () => {
  let database: Database;
  let repository: DrizzleUserRepository;

  beforeAll(async () => {
    database = await connectTestDatabase();
    repository = new DrizzleUserRepository(database.db);
  });

  beforeEach(() => truncateAll(database.db));
  afterAll(() => database.close());

  const input = { email: 'linus@example.com', displayName: 'Linus', passwordHash: 'hash' };

  it('creates a user and finds it by id and by email', async () => {
    const created = await repository.create(input);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeInstanceOf(Date);

    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByEmail('linus@example.com')).toEqual(created);
  });

  it('returns null for unknown users', async () => {
    expect(await repository.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
    expect(await repository.findByEmail('nobody@example.com')).toBeNull();
  });

  it('maps the unique email constraint to ConflictError', async () => {
    await repository.create(input);
    await expect(repository.create({ ...input, displayName: 'Other' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
