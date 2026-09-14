/** Storage key safety shared by every StorageBackend. Content types live in domain/entities/ImageFile. */
export { contentTypeForKey } from '../../../../domain/entities/ImageFile.js';

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]*$/i;

/** Keys are generated internally, but a backend must never be handed a path that escapes its root. */
export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}
