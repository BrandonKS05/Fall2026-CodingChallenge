import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../ports/PasswordHasher.js';

/** Adapter over @node-rs/argon2 (argon2id with the library's recommended defaults). */
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plainText: string): Promise<string> {
    return hash(plainText);
  }

  async verify(hashValue: string, plainText: string): Promise<boolean> {
    try {
      return await verify(hashValue, plainText);
    } catch {
      // A malformed or foreign hash is simply not a match.
      return false;
    }
  }
}
