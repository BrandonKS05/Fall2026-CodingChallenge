/** Extension point: add a provider here and implement its ImageProvider strategy. */
export const IMAGE_PROVIDERS = ['pixabay'] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

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
  provider: ImageProvider;
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
  sourceUrl: string;
  createdAt: Date;
}
