import { describe, expect, it } from 'vitest';
import { parseTags, pluralize, timeAgo } from './format';

describe('format helpers', () => {
  it('pluralizes', () => {
    expect(pluralize(1, 'image')).toBe('1 image');
    expect(pluralize(0, 'image')).toBe('0 images');
  });

  it('describes relative time', () => {
    const now = Date.parse('2026-09-14T12:00:00Z');
    expect(timeAgo('2026-09-14T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-09-14T11:30:00Z', now)).toBe('30 minutes ago');
    expect(timeAgo('2026-09-13T11:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-09-10T12:00:00Z', now)).toBe('4 days ago');
  });

  it('parses tag lists', () => {
    expect(parseTags(' wood, warm,,kitchen , wood ')).toEqual(['wood', 'warm', 'kitchen']);
  });
});
