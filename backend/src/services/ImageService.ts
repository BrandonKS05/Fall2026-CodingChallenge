/**
 * Image discovery and ingestion. Search goes to the provider strategy; saving
 * downloads the file into our own storage exactly once per provider image,
 * because provider URLs are temporary and hotlinking is not allowed.
 */
import { randomUUID } from 'node:crypto';
import type { Image, ImageProviderName } from '../domain/entities/Image.js';
import { extensionForContentType } from '../domain/entities/ImageFile.js';
import { ConflictError, InvalidOperationError, NotFoundError, UpstreamError } from '../domain/errors/index.js';
import type { FetchFn } from '../ports/HttpFetch.js';
import type { ImageProvider, ImageSearchQuery, ImageSearchResult } from '../ports/ImageProvider.js';
import type { Logger } from '../ports/Logger.js';
import type { ImageRepository } from '../ports/repositories/ImageRepository.js';
import type { StorageBackend, StoredObject } from '../ports/StorageBackend.js';

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

  constructor(private readonly deps: ImageServiceDeps) {
    this.log = deps.logger.child({ service: 'ImageService' });
    this.maxBytes = deps.maxBytes ?? 15 * 1024 * 1024;
    this.timeoutMs = deps.timeoutMs ?? 15_000;
  }

  search(query: ImageSearchQuery): Promise<ImageSearchResult> {
    return this.provider(DEFAULT_PROVIDER).search(query);
  }

  /** Returns the stored copy of a provider image, downloading it on first use. */
  async ensureStored(providerName: ImageProviderName, providerImageId: string): Promise<Image> {
    const existing = await this.deps.images.findByProviderId(providerName, providerImageId);
    if (existing) return existing;

    const hit = await this.provider(providerName).getById(providerImageId);
    if (!hit) throw new NotFoundError('Image', providerImageId);

    const file = await this.download(hit.downloadUrl);
    const key = `images/${randomUUID()}.${extensionForContentType(file.contentType)}`;
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

  /** The stored file for serving. */
  async open(imageId: string): Promise<StoredObject> {
    const image = await this.deps.images.findById(imageId);
    if (!image) throw new NotFoundError('Image', imageId);
    const object = await this.deps.storage.get(image.storageKey);
    if (!object) throw new NotFoundError('Image file', imageId);
    return object;
  }

  private provider(name: ImageProviderName): ImageProvider {
    const provider = this.deps.providers[name];
    if (!provider) throw new InvalidOperationError(`Unknown image provider: ${name}`);
    return provider;
  }

  private async download(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
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
    if (!extensionForContentType(contentType)) {
      throw new UpstreamError(`Unsupported image type: ${contentType || 'unknown'}`);
    }
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > this.maxBytes) throw new UpstreamError('Image is too large to store');

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.maxBytes) throw new UpstreamError('Image is too large to store');
    if (bytes.byteLength === 0) throw new UpstreamError('Image download was empty');
    return { bytes, contentType };
  }
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
