import type {
  Collection,
  CollectionSummary,
  CollectionVisibility,
  PublicImage,
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
  /** When set, only boards whose title or description contains these words. */
  term?: string;
  /** When set, `role` on each summary reflects this user's membership. */
  viewerId?: string;
}

export interface ListPublicImagesOptions {
  limit: number;
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
  /**
   * One person's boards at the given visibilities, for their profile page. The
   * caller decides which visibilities the viewer has earned; unlike Explore this
   * ignores the discovery setting, since a profile is reached by handle.
   */
  listByOwner(
    ownerId: string,
    options: { viewerId: string | null; visibilities: CollectionVisibility[] },
  ): Promise<CollectionSummary[]>;
  /**
   * Images on public boards for the landing stage: each image once (credited
   * to the most recently updated board that holds it), boards interleaved so
   * every board's newest image comes before any board's second, capped at limit.
   */
  listPublicImages(options: ListPublicImagesOptions): Promise<PublicImage[]>;
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
