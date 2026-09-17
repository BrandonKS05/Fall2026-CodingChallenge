import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type {
  VerificationChannel,
  VerificationCode,
} from '../../../domain/entities/Verification.js';
import type { Db } from '../../../infrastructure/db/client.js';
import { verificationCodes } from '../../../infrastructure/db/schema/index.js';
import type {
  NewVerificationCode,
  VerificationCodeRepository,
} from '../ports/VerificationCodeRepository.js';

type Row = typeof verificationCodes.$inferSelect;

const toCode = (row: Row): VerificationCode => ({
  id: row.id,
  channel: row.channel,
  target: row.target,
  codeHash: row.codeHash,
  expiresAt: row.expiresAt,
  attempts: row.attempts,
  consumedAt: row.consumedAt,
  createdAt: row.createdAt,
});

export class DrizzleVerificationCodeRepository implements VerificationCodeRepository {
  constructor(private readonly db: Db) {}

  async create(input: NewVerificationCode): Promise<VerificationCode> {
    const [row] = await this.db.insert(verificationCodes).values(input).returning();
    if (!row) throw new Error('Insert returned no row');
    return toCode(row);
  }

  async findActive(channel: VerificationChannel, target: string): Promise<VerificationCode | null> {
    const row = await this.db.query.verificationCodes.findFirst({
      where: and(
        eq(verificationCodes.channel, channel),
        eq(verificationCodes.target, target),
        isNull(verificationCodes.consumedAt),
        gt(verificationCodes.expiresAt, sql`now()`),
      ),
      orderBy: desc(verificationCodes.createdAt),
    });
    return row ? toCode(row) : null;
  }

  async lastIssuedAt(channel: VerificationChannel, target: string): Promise<Date | null> {
    const row = await this.db.query.verificationCodes.findFirst({
      where: and(eq(verificationCodes.channel, channel), eq(verificationCodes.target, target)),
      orderBy: desc(verificationCodes.createdAt),
    });
    return row?.createdAt ?? null;
  }

  async countSince(channel: VerificationChannel, target: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.channel, channel),
          eq(verificationCodes.target, target),
          gt(verificationCodes.createdAt, since),
        ),
      );
    return row?.count ?? 0;
  }

  async recordAttempt(id: string): Promise<number> {
    const [row] = await this.db
      .update(verificationCodes)
      .set({ attempts: sql`${verificationCodes.attempts} + 1` })
      .where(eq(verificationCodes.id, id))
      .returning({ attempts: verificationCodes.attempts });
    return row?.attempts ?? 0;
  }

  async consume(id: string): Promise<void> {
    await this.db
      .update(verificationCodes)
      .set({ consumedAt: sql`now()` })
      .where(eq(verificationCodes.id, id));
  }
}
