import { createHash } from 'node:crypto';
import type { EmbeddableItem } from '../../domain/entities/Embedding.js';

/**
 * What gets embedded, and how we know when it has changed.
 *
 * A saved picture carries three sources of words: the caption whoever saved it
 * wrote, the tags they gave it, and the tags the picture arrived with. The
 * first two are the person's own voice and come first; the third is included
 * because a board's own tags are a three-word truncation of the picture's, and
 * three words is thin evidence of what something is about.
 */
export type { EmbeddableItem };

/** Lowercased, trimmed, first occurrence wins, blanks dropped. */
function distinct(values: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const word = value.trim().toLowerCase();
    if (word === '' || seen.has(word)) continue;
    seen.add(word);
    kept.push(word);
  }
  return kept;
}

/**
 * One string per picture. Tags are joined with commas rather than hashed,
 * because the model reads them as words and "#golden hour" is not a word.
 */
export function embeddingText(item: EmbeddableItem): string {
  const tags = distinct([...item.tags, ...item.image.tags]);
  const caption = item.caption.trim();
  const parts = [caption, tags.join(', ')].filter((part) => part !== '');
  return parts.join('. ');
}

/**
 * A digest of the text, stored beside the vector. An edit to a caption or a
 * tag changes it, which is how the worker tells the handful of pictures that
 * need embedding again from the thousands that do not.
 */
export function embeddingInputHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}
