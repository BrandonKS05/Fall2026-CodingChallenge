import type { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ImageProviderName } from '../../domain/entities/Image.js';
import {
  ConflictError,
  InvalidOperationError,
  NotFoundError,
  UpstreamError,
} from '../../domain/errors/index.js';
import type { NewImage } from './ports/ImageRepository.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { createFakeFetch, FAKE_JPEG } from '../../testing/fakes/fakeFetch.js';
import { FakeImageProvider, fakeProviderImage } from '../../testing/fakes/FakeImageProvider.js';
import { InMemoryImageRepository } from '../../testing/fakes/InMemoryImageRepository.js';
import { InMemoryStorage } from '../../testing/fakes/InMemoryStorage.js';
import { ImageService } from './ImageService.js';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

describe('ImageService', () => {
  let images: InMemoryImageRepository;
  let storage: InMemoryStorage;
  let provider: FakeImageProvider;
  let fetchFn: ReturnType<typeof createFakeFetch>;
  let service: ImageService;

  beforeEach(() => {
    images = new InMemoryImageRepository();
    storage = new InMemoryStorage();
    provider = new FakeImageProvider([
      fakeProviderImage('101'),
      fakeProviderImage('102', { downloadUrl: 'https://fake.test/download/102.html' }),
      fakeProviderImage('103', { downloadUrl: 'https://fake.test/download/103.jpg' }),
    ]);
    fetchFn = createFakeFetch({
      'https://fake.test/download/101.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
      'https://fake.test/download/102.html': { contentType: 'text/html', body: '<html/>' },
      'https://fake.test/download/103.jpg': {
        contentType: 'image/jpeg',
        body: new Uint8Array(2048),
      },
    });
    service = new ImageService({
      images,
      providers: { pixabay: provider },
      storage,
      fetchFn,
      logger: silentLogger,
      maxBytes: 1024,
    });
  });

  it('downloads a provider image once and reuses it afterwards', async () => {
    const first = await service.ensureStored('pixabay', '101');
    expect(first.storageKey).toMatch(/^images\/[0-9a-f-]{36}\.jpg$/);
    expect(first).toMatchObject({
      width: 1920,
      height: 1280,
      tags: ['kitchen', 'wood'],
      blurhash: null,
      palette: [],
    });
    expect(storage.objects.get(first.storageKey)?.body).toEqual(FAKE_JPEG);

    const second = await service.ensureStored('pixabay', '101');
    expect(second.id).toBe(first.id);
    expect(fetchFn.calls).toHaveLength(1);
    expect(provider.getByIdCalls).toEqual(['101']);
  });

  it('rejects unknown images, unknown providers, wrong types, and oversized files', async () => {
    await expect(service.ensureStored('pixabay', '999')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.ensureStored('unsplash' as ImageProviderName, '1')).rejects.toBeInstanceOf(
      InvalidOperationError,
    );
    await expect(service.ensureStored('pixabay', '102')).rejects.toThrow(/Unsupported image type/);
    await expect(service.ensureStored('pixabay', '103')).rejects.toThrow(/too large/);
    expect(storage.objects.size).toBe(0);
  });

  it('keeps the winner and discards its own copy when a concurrent save got there first', async () => {
    class RacingRepository extends InMemoryImageRepository {
      override async create(input: NewImage): Promise<never> {
        await super.create({ ...input, storageKey: 'images/winner.jpg' });
        throw new ConflictError('Image was already stored');
      }
    }
    const racing = new RacingRepository();
    const racingService = new ImageService({
      images: racing,
      providers: { pixabay: provider },
      storage,
      fetchFn,
      logger: silentLogger,
    });

    const image = await racingService.ensureStored('pixabay', '101');
    expect(image.storageKey).toBe('images/winner.jpg');
    expect(storage.objects.size).toBe(0);
  });

  it('opens stored files and reports missing ones', async () => {
    const image = await service.ensureStored('pixabay', '101');
    const object = await service.open(image.id);
    expect(object.contentType).toBe('image/jpeg');
    expect(await readAll(object.stream)).toEqual(Buffer.from(FAKE_JPEG));

    await expect(service.open('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe('open with a missing file', () => {
    it('restores the file from the provider under the same key and serves it', async () => {
      const image = await service.ensureStored('pixabay', '101');
      storage.objects.clear();
      fetchFn.calls.length = 0;

      const object = await service.open(image.id);
      expect(await readAll(object.stream)).toEqual(Buffer.from(FAKE_JPEG));
      expect(storage.objects.has(image.storageKey)).toBe(true);
      expect(fetchFn.calls).toEqual(['https://fake.test/download/101.jpg']);
      expect((await images.findById(image.id))?.storageKey).toBe(image.storageKey);
    });

    it('downloads once however many requests arrive for the same lost file', async () => {
      const image = await service.ensureStored('pixabay', '101');
      storage.objects.clear();
      fetchFn.calls.length = 0;

      const objects = await Promise.all([
        service.open(image.id),
        service.open(image.id),
        service.open(image.id),
      ]);
      expect(objects).toHaveLength(3);
      expect(fetchFn.calls).toEqual(['https://fake.test/download/101.jpg']);
    });

    it('moves to a new key when the provider now serves a different file type', async () => {
      const image = await service.ensureStored('pixabay', '101');
      storage.objects.clear();
      const nowPng = new ImageService({
        images,
        providers: {
          pixabay: new FakeImageProvider([
            fakeProviderImage('101', { downloadUrl: 'https://fake.test/download/101.png' }),
          ]),
        },
        storage,
        fetchFn: createFakeFetch({
          'https://fake.test/download/101.png': { contentType: 'image/png', body: FAKE_JPEG },
        }),
        logger: silentLogger,
      });

      const object = await nowPng.open(image.id);
      expect(object.contentType).toBe('image/png');
      const updated = await images.findById(image.id);
      expect(updated?.storageKey).toMatch(/\.png$/);
      expect(updated?.storageKey).not.toBe(image.storageKey);
      expect(storage.objects.has(updated?.storageKey ?? '')).toBe(true);
    });

    it('still reports the file missing when the provider no longer has the image', async () => {
      const image = await service.ensureStored('pixabay', '101');
      storage.objects.clear();
      const gone = new ImageService({
        images,
        providers: { pixabay: new FakeImageProvider([]) },
        storage,
        fetchFn,
        logger: silentLogger,
      });
      await expect(gone.open(image.id)).rejects.toThrow(/Image file/);
      expect(storage.objects.size).toBe(0);
    });
  });

  it('delegates search to the default provider', async () => {
    const result = await service.search({ q: 'kitchen', page: 1, perPage: 10, orientation: 'all' });
    expect(result.results.map((r) => r.providerImageId)).toEqual(['101', '102', '103']);
    await expect(service.ensureStored('pixabay', '104')).rejects.toBeInstanceOf(NotFoundError);
    void UpstreamError;
  });
});
