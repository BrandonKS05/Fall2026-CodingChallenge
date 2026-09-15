import type { LikeRepository } from '../../modules/collections/ports/LikeRepository.js';

export class InMemoryLikeRepository implements LikeRepository {
  /** "collectionId:userId" pairs. */
  readonly rows = new Set<string>();

  async like(collectionId: string, userId: string): Promise<boolean> {
    const key = `${collectionId}:${userId}`;
    if (this.rows.has(key)) return false;
    this.rows.add(key);
    return true;
  }

  async unlike(collectionId: string, userId: string): Promise<boolean> {
    return this.rows.delete(`${collectionId}:${userId}`);
  }

  count(collectionId: string): number {
    return [...this.rows].filter((key) => key.startsWith(`${collectionId}:`)).length;
  }

  has(collectionId: string, userId: string | null): boolean {
    return userId !== null && this.rows.has(`${collectionId}:${userId}`);
  }
}
