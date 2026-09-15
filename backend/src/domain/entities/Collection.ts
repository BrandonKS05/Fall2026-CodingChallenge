import type { Image } from './Image.js';
import type { CollectionRole } from './Membership.js';

/**
 * private  - members only
 * unlisted - anyone with the share link
 * public   - anyone with the link, and listed on Explore
 */
export const COLLECTION_VISIBILITIES = ['private', 'unlisted', 'public'] as const;
export type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number];

export interface Collection {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: CollectionVisibility;
  /** Set once a share link exists; null otherwise. */
  shareSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Read model for board lists and cards: the entity plus what a card renders. */
export interface CollectionSummary extends Collection {
  ownerDisplayName: string;
  itemCount: number;
  /** Up to four most recent image ids for the cover mosaic. */
  previewImageIds: string[];
  /** The viewing user's role, or null for a non-member. */
  role: CollectionRole | null;
}

/** An image on a public board, credited to that board, for the landing stage. */
export interface PublicImage {
  image: Image;
  collectionId: string;
  collectionTitle: string;
}
