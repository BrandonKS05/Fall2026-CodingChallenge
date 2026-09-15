import { describe, expect, it } from 'vitest';
import { pixabayResponseSchema, toProviderImage } from './pixabayAdapter.js';

export const sampleHit = {
  id: 195893,
  pageURL: 'https://pixabay.com/photos/blossom-bloom-flower-195893/',
  tags: 'blossom, bloom, flower',
  previewURL: 'https://cdn.pixabay.com/photo/preview_150.jpg',
  previewWidth: 150,
  previewHeight: 84,
  webformatURL: 'https://pixabay.com/get/web_640.jpg',
  largeImageURL: 'https://pixabay.com/get/large_1280.jpg',
  imageWidth: 4000,
  imageHeight: 2250,
  user: 'Josch13',
  user_id: 48777,
};

describe('pixabay adapter', () => {
  it('maps a hit into the provider-agnostic shape', () => {
    const image = toProviderImage(sampleHit);
    expect(image).toEqual({
      provider: 'pixabay',
      providerImageId: '195893',
      previewUrl: sampleHit.previewURL,
      previewWidth: 150,
      previewHeight: 84,
      displayUrl: sampleHit.webformatURL,
      downloadUrl: sampleHit.largeImageURL,
      width: 4000,
      height: 2250,
      tags: ['blossom', 'bloom', 'flower'],
      credit: { name: 'Josch13', url: 'https://pixabay.com/users/Josch13-48777/' },
      sourceUrl: sampleHit.pageURL,
    });
  });

  it('accepts extra fields but rejects a changed shape', () => {
    const ok = pixabayResponseSchema.safeParse({
      total: 1,
      totalHits: 1,
      hits: [{ ...sampleHit, likes: 3 }],
    });
    expect(ok.success).toBe(true);
    const bad = pixabayResponseSchema.safeParse({ total: 1, totalHits: 1, hits: [{ id: 'nope' }] });
    expect(bad.success).toBe(false);
  });
});
