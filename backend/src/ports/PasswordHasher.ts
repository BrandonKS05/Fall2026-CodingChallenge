/** Strategy for password hashing. The service never knows which algorithm is behind it. */
export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  /** Resolves false for a mismatch or a malformed hash; never throws. */
  verify(hash: string, plainText: string): Promise<boolean>;
}
