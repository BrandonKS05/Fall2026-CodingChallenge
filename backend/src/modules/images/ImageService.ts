/**
 * Image discovery and ingestion. Search goes to the provider strategy; saving
 * downloads the file into our own storage exactly once per provider image,
 * because provider URLs are temporary and hotlinking is not allowed.
 */
import { randomUUID } from 'node:crypto';
import type { Image, ImageProviderName } from '../../domain/entities/Image.js';
import { contentTypeForKey, extensionForContentType } from '../../domain/entities/ImageFile.js';
import { LANDING_IMAGE_IDS, LANDING_PROVIDER } from './landingImages.js';
import {
  ConflictError,
  InvalidOperationError,
  NotFoundError,
  UpstreamError,
} from '../../domain/errors/index.js';
import type { FetchFn } from '../../infrastructure/http/fetch.js';
import type { ImageProvider, ImageSearchQuery, ImageSearchResult } from './ports/ImageProvider.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { ImageRepository } from './ports/ImageRepository.js';
import type { StorageBackend, StoredObject } from './ports/StorageBackend.js';

/** Strategy registry: one provider per name. Adding Unsplash means adding an entry here. */
export type ProviderRegistry = Partial<Record<ImageProviderName, ImageProvider>>;

export interface ImageServiceDeps {
  images: ImageRepository;
  providers: ProviderRegistry;
  storage: StorageBackend;
  fetchFn: FetchFn;
  logger: Logger;
  /** Refuse downloads above this size. */
  maxBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_PROVIDER: ImageProviderName = 'pixabay';
const INSECURE_HOSTS_ALLOWED = new Set(['localhost', '127.0.0.1']);

export class ImageService {
  private readonly log: Logger;
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  /** One in-flight restore per image, so a burst of requests for a lost file downloads it once. */
  private readonly restores = new Map<string, Promise<Image>>();

  constructor(private readonly deps: ImageServiceDeps) {
    this.log = deps.logger.child({ service: 'ImageService' });
    this.maxBytes = deps.maxBytes ?? 15 * 1024 * 1024;
    this.timeoutMs = deps.timeoutMs ?? 15_000;
  }

  /**
   * The landing stage's fixed curation, in the order it is written down. It
   * reads the image table alone: no board, no saved item, nothing a person can
   * change, so the front of the product stays put.
   */
  async landingFeed(limit: number): Promise<Image[]> {
    const wanted = LANDING_IMAGE_IDS.slice(0, limit);
    const stored = await this.deps.images.listByProviderIds(LANDING_PROVIDER, [...wanted]);
    const byProviderId = new Map(stored.map((image) => [image.providerImageId, image]));
    return wanted.flatMap((providerImageId) => {
      const image = byProviderId.get(providerImageId);
      return image ? [image] : [];
    });
  }

  /**
   * Discovery, minus anything the viewer has muted. The provider still decides
   * what matches; muting only removes hits before they are shown, so the count
   * the provider reports stays its own.
   */
  async search(
    query: ImageSearchQuery,
    options: { mutedTags?: readonly string[] } = {},
  ): Promise<ImageSearchResult> {
    const found = await this.provider(DEFAULT_PROVIDER).search(query);
    const muted = new Set(options.mutedTags ?? []);
    if (muted.size === 0) return found;
    return {
      ...found,
      results: found.results.filter((hit) => !hit.tags.some((tag) => muted.has(tag.toLowerCase()))),
    };
  }

  /** Returns the stored copy of a provider image, downloading it on first use. */
  async ensureStored(providerName: ImageProviderName, providerImageId: string): Promise<Image> {
    const existing = await this.deps.images.findByProviderId(providerName, providerImageId);
    if (existing) return existing;

    const hit = await this.provider(providerName).getById(providerImageId);
    if (!hit) throw new NotFoundError('Image', providerImageId);

    const file = await this.download(hit.downloadUrl);
    const key = `images/${randomUUID()}.${file.extension}`;
    await this.deps.storage.put(key, file.bytes, file.contentType);

    try {
      const image = await this.deps.images.create({
        provider: hit.provider,
        providerImageId: hit.providerImageId,
        storageKey: key,
        width: hit.width,
        height: hit.height,
        blurhash: null,
        palette: [],
        tags: hit.tags,
        credit: hit.credit,
        sourceUrl: hit.sourceUrl,
      });
      this.log.info({ imageId: image.id, bytes: file.bytes.byteLength }, 'Image stored');
      return image;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      // A concurrent save stored the same image first. Keep theirs, discard our copy.
      await this.deps.storage.delete(key).catch(() => undefined);
      const winner = await this.deps.images.findByProviderId(providerName, providerImageId);
      if (winner) return winner;
      throw error;
    }
  }

  /**
   * The stored file for serving. A missing file is restored from the provider
   * first: the database is the source of truth and the file store is a cache
   * that can be rebuilt, so a lost disk (or STORAGE_LOCAL_DIR pointing at an
   * ephemeral directory) costs one slow request per image, not a broken image.
   */
  async open(imageId: string): Promise<StoredObject> {
    const image = await this.deps.images.findById(imageId);
    if (!image) throw new NotFoundError('Image', imageId);
    const object = await this.deps.storage.get(image.storageKey);
    if (object) return object;

    const restored = await this.restore(image);
    const file = await this.deps.storage.get(restored.storageKey);
    if (!file) throw new NotFoundError('Image file', imageId);
    return file;
  }

  /** Coalesces concurrent restores of the same image into one download. */
  private restore(image: Image): Promise<Image> {
    const pending = this.restores.get(image.id);
    if (pending) return pending;
    const task = this.redownload(image).finally(() => this.restores.delete(image.id));
    this.restores.set(image.id, task);
    return task;
  }

  private async redownload(image: Image): Promise<Image> {
    const hit = await this.provider(image.provider).getById(image.providerImageId);
    if (!hit) {
      this.log.warn(
        { imageId: image.id },
        'Image file is missing and the provider no longer has it',
      );
      throw new NotFoundError('Image file', image.id);
    }
    const file = await this.download(hit.downloadUrl);
    // The key's extension must stay truthful, so a provider that now serves another type gets a new key.
    const key =
      contentTypeForKey(image.storageKey) === file.contentType
        ? image.storageKey
        : `images/${randomUUID()}.${file.extension}`;
    await this.deps.storage.put(key, file.bytes, file.contentType);
    const restored =
      key === image.storageKey
        ? image
        : await this.deps.images.update(image.id, { storageKey: key });
    this.log.warn(
      { imageId: image.id, storageKey: key, bytes: file.bytes.byteLength },
      'Image file was missing; restored from the provider',
    );
    return restored;
  }

  private provider(name: ImageProviderName): ImageProvider {
    const provider = this.deps.providers[name];
    if (!provider) throw new InvalidOperationError(`Unknown image provider: ${name}`);
    return provider;
  }

  private async download(url: string): Promise<DownloadedFile> {
    assertDownloadable(url);

    let response: Response;
    try {
      response = await this.deps.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw new UpstreamError('Could not reach the image provider to download the image');
    }
    if (!response.ok) {
      throw new UpstreamError(`Image download failed (${response.status})`, response.status);
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    const extension = extensionForContentType(contentType);
    if (!extension) {
      throw new UpstreamError(`Unsupported image type: ${contentType || 'unknown'}`);
    }
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > this.maxBytes) throw new UpstreamError('Image is too large to store');

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.maxBytes) throw new UpstreamError('Image is too large to store');
    if (bytes.byteLength === 0) throw new UpstreamError('Image download was empty');
    return { bytes, contentType, extension };
  }
}

interface DownloadedFile {
  bytes: Uint8Array;
  contentType: string;
  /** Validated against the accepted types, so keys built from it always serve the right content type. */
  extension: string;
}

/** Download URLs come from the provider, never the client, but they still must be https (or local during development). */
function assertDownloadable(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UpstreamError('Provider returned an invalid download URL');
  }
  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && INSECURE_HOSTS_ALLOWED.has(parsed.hostname)) return;
  throw new UpstreamError('Provider returned a non-https download URL');
}
