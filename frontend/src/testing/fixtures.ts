/** Contract-shaped fixtures for component tests. */
import type { Collection, Item, SearchResult } from '@trove/shared';

const now = new Date('2026-09-14T12:00:00Z').toISOString();

export function boardFixture(overrides: Partial<Collection> = {}): Collection {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    owner: { id: 'u1', displayName: 'Ada' },
    title: 'Kitchen ideas',
    description: 'Warm wood, black taps',
    visibility: 'private',
    shareSlug: null,
    previewImageIds: [],
    itemCount: 0,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function itemFixture(overrides: Partial<Item> = {}): Item {
  const id = overrides.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  return {
    id,
    collectionId: '11111111-1111-4111-8111-111111111111',
    image: {
      id: `img-${id}`,
      url: `/api/images/img-${id}`,
      width: 1600,
      height: 1200,
      blurhash: null,
      palette: [],
      tags: ['wood', 'kitchen'],
      credit: { name: 'photographer', profileUrl: null },
      sourceUrl: 'https://pixabay.com/photos/1/',
      provider: 'pixabay',
      providerImageId: '1',
    },
    caption: 'Oak island',
    tags: ['island'],
    position: 0,
    addedBy: { id: 'u1', displayName: 'Ada' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function searchResultFixture(id: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    provider: 'pixabay',
    providerImageId: id,
    previewUrl: `https://cdn.test/preview/${id}.jpg`,
    previewWidth: 150,
    previewHeight: 100,
    displayUrl: `https://cdn.test/display/${id}.jpg`,
    width: 1920,
    height: 1280,
    tags: ['kitchen', 'oak', `tag${id}`],
    credit: { name: 'photographer', profileUrl: null },
    sourceUrl: `https://pixabay.com/photos/${id}/`,
    ...overrides,
  };
}

export const userFixture = { id: 'u1', email: 'ada@example.com', displayName: 'Ada', createdAt: now };
