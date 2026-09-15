import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  timedCheck,
  type HealthCheckResult,
  type HealthIndicator,
} from '../../../health/ports/HealthIndicator.js';
import type { StorageBackend } from '../../ports/StorageBackend.js';

const PROBE_BODY = new TextEncoder().encode('trove storage probe');

/**
 * Strategy: proves the StorageBackend can write, read back, and delete. A
 * deploy whose volume is not mounted or whose bucket credentials are wrong
 * then fails its health check instead of answering 404 for every image.
 */
export class StorageHealthIndicator implements HealthIndicator {
  readonly name = 'storage';

  constructor(
    private readonly storage: StorageBackend,
    private readonly timeoutMs = 5_000,
  ) {}

  check(): Promise<HealthCheckResult> {
    return timedCheck(() => this.probe(), this.timeoutMs);
  }

  private async probe(): Promise<void> {
    // A unique key per probe, so overlapping health checks never read each other's file.
    const key = `health/probe-${randomUUID()}.txt`;
    try {
      await this.storage.put(key, PROBE_BODY, 'text/plain');
      const object = await this.storage.get(key);
      if (!object) throw new Error('Probe file was not readable after writing');
      const body = await readAll(object.stream);
      if (!body.equals(Buffer.from(PROBE_BODY))) {
        throw new Error('Probe file read back different bytes');
      }
    } finally {
      await this.storage.delete(key).catch(() => undefined);
    }
  }
}

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}
