import { randomUUID } from 'node:crypto';
import type { VerificationChannel, VerificationCode } from '../../domain/entities/Verification.js';
import type {
  NewVerificationCode,
  VerificationCodeRepository,
} from '../../modules/auth/ports/VerificationCodeRepository.js';
import { nextInstant } from './clock.js';

/** Port-conformant fake: the same rules about newest, unspent and unexpired. */
export class InMemoryVerificationCodeRepository implements VerificationCodeRepository {
  private readonly rows: VerificationCode[] = [];

  async create(input: NewVerificationCode): Promise<VerificationCode> {
    const row: VerificationCode = {
      id: randomUUID(),
      ...input,
      attempts: 0,
      consumedAt: null,
      createdAt: nextInstant(),
    };
    this.rows.push(row);
    return row;
  }

  async findActive(channel: VerificationChannel, target: string): Promise<VerificationCode | null> {
    const now = new Date();
    return (
      this.forTarget(channel, target)
        .filter((row) => row.consumedAt === null && row.expiresAt > now)
        .at(-1) ?? null
    );
  }

  async lastIssuedAt(channel: VerificationChannel, target: string): Promise<Date | null> {
    return this.forTarget(channel, target).at(-1)?.createdAt ?? null;
  }

  async countSince(channel: VerificationChannel, target: string, since: Date): Promise<number> {
    return this.forTarget(channel, target).filter((row) => row.createdAt > since).length;
  }

  async recordAttempt(id: string): Promise<number> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) return 0;
    row.attempts += 1;
    return row.attempts;
  }

  async consume(id: string): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) row.consumedAt = nextInstant();
  }

  private forTarget(channel: VerificationChannel, target: string): VerificationCode[] {
    return this.rows.filter((row) => row.channel === channel && row.target === target);
  }
}
