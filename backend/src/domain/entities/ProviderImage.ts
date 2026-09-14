import type { ImageCredit, ImageProviderName } from './Image.js';

/**
 * A search hit from an image provider, in provider-agnostic form. The URLs
 * are the provider's and are temporary: displayed in results, never stored.
 */
export interface ProviderImage {
  provider: ImageProviderName;
  providerImageId: string;
  /** Small thumbnail (about 150px) for the instant grid placeholder. */
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  /** Medium image (about 640px) shown in results. */
  displayUrl: string;
  /** The file the backend downloads when the image is saved. */
  downloadUrl: string;
  /** Dimensions of the original, for aspect-ratio layout. */
  width: number;
  height: number;
  tags: string[];
  credit: ImageCredit;
  sourceUrl: string;
}
