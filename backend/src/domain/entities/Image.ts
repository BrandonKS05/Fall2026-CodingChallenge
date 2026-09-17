/** Extension point: add a provider here and implement its ImageProvider strategy. */
/** 'upload' is not a provider so much as its absence: the picture came from a person. */
export const IMAGE_PROVIDERS = ['pixabay', 'upload'] as const;
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];

export interface ImageCredit {
  name: string;
  url: string | null;
}

/**
 * An image downloaded into our own storage. Stored once per provider image
 * and referenced by any number of collection items.
 */
export interface Image {
  id: string;
  provider: ImageProviderName;
  providerImageId: string;
  /** Key understood by the StorageBackend that holds the file. */
  storageKey: string;
  width: number;
  height: number;
  blurhash: string | null;
  /** Dominant colors as hex strings. Empty until extracted. */
  palette: string[];
  tags: string[];
  credit: ImageCredit;
  /** Where it came from; null for an upload, which came from whoever sent it. */
  sourceUrl: string | null;
  createdAt: Date;
}
