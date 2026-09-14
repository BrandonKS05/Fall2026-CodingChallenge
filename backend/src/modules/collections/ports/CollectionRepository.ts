import type {
  Collection,
  CollectionSummary,
  CollectionVisibility,
} from '../../../domain/entities/Collection.js';

export interface NewCollection {
  ownerId: string;
  title: string;
  description: string;
  visibility: CollectionVisibility;
}

export type CollectionPatch = Partial<Pick<Collection, 'title' | 'description' | 'visibility'>>;

export interface ListPublicOptions {
  limit: number;
  offset: number;
  /** When set, `role` on each summary reflects this user's membership. */
  viewerId?: string;
}

export interface CollectionRepository {
  findById(id: string): Promise<Collection | null>;
  findByShareSlug(slug: string): Promise<Collection | null>;
  /** One board as seen by `viewerId` (null for anonymous), with counts and previews. */
  findSummary(id: string, viewerId: string | null): Promise<CollectionSummary | null>;
  /** Boards the user owns or belongs to, most recently updated first. */
  listForUser(userId: string): Promise<CollectionSummary[]>;
  /** Public boards for Explore, most recently updated first. */
  listPublic(options: ListPublicOptions): Promise<CollectionSummary[]>;
  /** Creates the board and its owner membership atomically. */
  create(input: NewCollection): Promise<Collection>;
  /** Throws NotFoundError when the id does not exist. */
  update(id: string, patch: CollectionPatch): Promise<Collection>;
  /** Throws NotFoundError when the id does not exist; null revokes the link. */
  setShareSlug(id: string, slug: string | null): Promise<Collection>;
  /** Bumps updatedAt, used when items change so board lists reorder. */
  touch(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
