import type { ProviderImage } from '../../domain/entities/ProviderImage.js';
import type { ImageProvider, ImageSearchQuery, ImageSearchResult } from '../../ports/ImageProvider.js';

/** Builds a plausible provider hit; every URL points at a fake host so tests never touch the network. */
export function fakeProviderImage(id: string, overrides: Partial<ProviderImage> = {}): ProviderImage {
  return {
    provider: 'pixabay',
    providerImageId: id,
    previewUrl: `https://fake.test/preview/${id}.jpg`,
    previewWidth: 150,
    previewHeight: 100,
    displayUrl: `https://fake.test/display/${id}.jpg`,
    downloadUrl: `https://fake.test/download/${id}.jpg`,
    width: 1920,
    height: 1280,
    tags: ['kitchen', 'wood'],
    credit: { name: 'photographer', url: 'https://fake.test/users/photographer' },
    sourceUrl: `https://fake.test/photos/${id}`,
    ...overrides,
  };
}

export class FakeImageProvider implements ImageProvider {
  readonly name = 'pixabay' as const;
  searchCalls: ImageSearchQuery[] = [];
  getByIdCalls: string[] = [];

  constructor(private readonly catalog: ProviderImage[]) {}

  async search(query: ImageSearchQuery): Promise<ImageSearchResult> {
    this.searchCalls.push(query);
    const matching = this.catalog.filter((image) =>
      image.tags.some((tag) => tag.includes(query.q.toLowerCase())),
    );
    const start = (query.page - 1) * query.perPage;
    return {
      results: matching.slice(start, start + query.perPage),
      page: query.page,
      perPage: query.perPage,
      total: matching.length,
    };
  }

  async getById(providerImageId: string): Promise<ProviderImage | null> {
    this.getByIdCalls.push(providerImageId);
    return this.catalog.find((image) => image.providerImageId === providerImageId) ?? null;
  }
}
