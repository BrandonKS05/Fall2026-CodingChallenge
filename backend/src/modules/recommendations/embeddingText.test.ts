import { describe, expect, it } from 'vitest';
import { embeddingInputHash, embeddingText } from './embeddingText.js';

const item = (overrides: Partial<Parameters<typeof embeddingText>[0]> = {}) => ({
  caption: 'Oak island',
  tags: ['kitchen', 'wood'],
  image: { tags: ['kitchen', 'home', 'interior'] },
  ...overrides,
});

describe('embeddingText', () => {
  it("puts the person's words first, then every tag once", () => {
    expect(embeddingText(item())).toBe('Oak island. kitchen, wood, home, interior');
  });

  it('is the tags alone when nobody wrote a caption', () => {
    expect(embeddingText(item({ caption: '   ' }))).toBe('kitchen, wood, home, interior');
  });

  it('is the caption alone when the picture arrived without tags', () => {
    expect(embeddingText(item({ tags: [], image: { tags: [] } }))).toBe('Oak island');
  });

  it('treats tags as the same word however they were typed', () => {
    const text = embeddingText(item({ caption: '', tags: ['Kitchen', ' KITCHEN '] }));
    expect(text).toBe('kitchen, home, interior');
  });

  it('has nothing to say about a picture with no words at all', () => {
    expect(embeddingText(item({ caption: '', tags: [], image: { tags: [] } }))).toBe('');
  });
});

describe('embeddingInputHash', () => {
  it('is the same for the same text and different for a changed one', () => {
    expect(embeddingInputHash('a, b')).toBe(embeddingInputHash('a, b'));
    expect(embeddingInputHash('a, b')).not.toBe(embeddingInputHash('a, c'));
  });
});
