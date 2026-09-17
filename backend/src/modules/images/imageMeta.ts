/**
 * The width and height of an uploaded picture, read from the file's own header.
 *
 * Four formats cover everything a browser will hand over, and each states its
 * size in the first few dozen bytes, so there is no decoding here and no
 * dependency: just enough of each format to answer one question. A file whose
 * header does not parse is not an image we are willing to store.
 */
import { InvalidOperationError } from '../../domain/errors/index.js';

export interface ImageMeta {
  width: number;
  height: number;
  contentType: string;
  extension: string;
}

const MAX_SIDE = 12_000;

export function readImageMeta(bytes: Uint8Array): ImageMeta {
  const meta = png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes);
  if (!meta) throw new InvalidOperationError('That file is not a PNG, JPEG, GIF or WebP');
  if (meta.width < 1 || meta.height < 1 || meta.width > MAX_SIDE || meta.height > MAX_SIDE) {
    throw new InvalidOperationError('That image is an impossible size');
  }
  return meta;
}

const starts = (bytes: Uint8Array, signature: number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

const be32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) << 24) |
  ((bytes[at + 1] ?? 0) << 16) |
  ((bytes[at + 2] ?? 0) << 8) |
  (bytes[at + 3] ?? 0);
const be16 = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const le16 = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const le24 = (bytes: Uint8Array, at: number) =>
  (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);

/** IHDR is always the first chunk, and carries the size in two big-endian words. */
function png(bytes: Uint8Array): ImageMeta | null {
  if (!starts(bytes, [0x89, 0x50, 0x4e, 0x47])) return null;
  return {
    width: be32(bytes, 16),
    height: be32(bytes, 20),
    contentType: 'image/png',
    extension: 'png',
  };
}

/** The logical screen descriptor, little-endian, right after "GIF89a". */
function gif(bytes: Uint8Array): ImageMeta | null {
  if (!starts(bytes, [0x47, 0x49, 0x46])) return null;
  return {
    width: le16(bytes, 6),
    height: le16(bytes, 8),
    contentType: 'image/gif',
    extension: 'gif',
  };
}

/** RIFF with a WEBP tag, then one of three chunk layouts. */
function webp(bytes: Uint8Array): ImageMeta | null {
  if (!starts(bytes, [0x52, 0x49, 0x46, 0x46]) || !starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return null;
  }
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  const meta = { contentType: 'image/webp', extension: 'webp' };
  if (kind === 'VP8X') {
    return { ...meta, width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  }
  if (kind === 'VP8L') {
    const bits = le32(bytes, 21);
    return { ...meta, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') {
    return { ...meta, width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  return null;
}

const le32 = (bytes: Uint8Array, at: number) =>
  ((bytes[at] ?? 0) |
    ((bytes[at + 1] ?? 0) << 8) |
    ((bytes[at + 2] ?? 0) << 16) |
    ((bytes[at + 3] ?? 0) << 24)) >>>
  0;

/**
 * JPEG keeps its size in a start-of-frame marker, which sits after however
 * many other segments the encoder felt like writing, so the segments are
 * walked until one of them is a frame header.
 */
function jpeg(bytes: Uint8Array): ImageMeta | null {
  if (!starts(bytes, [0xff, 0xd8])) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1] ?? 0;
    // Start of frame, in every flavour except the four that are not frames.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return {
        height: be16(bytes, at + 5),
        width: be16(bytes, at + 7),
        contentType: 'image/jpeg',
        extension: 'jpg',
      };
    }
    at += 2 + be16(bytes, at + 2);
  }
  return null;
}
