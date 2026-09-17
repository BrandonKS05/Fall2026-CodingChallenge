import { describe, expect, it } from 'vitest';
import { InvalidOperationError } from '../../domain/errors/index.js';
import { readImageMeta } from './imageMeta.js';

/** Just the header bytes each format states its size in; the pixels are nobody's business here. */
const png = (w: number, h: number) => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(16, w);
  new DataView(bytes.buffer).setUint32(20, h);
  return bytes;
};

const gif = (w: number, h: number) => {
  const bytes = new Uint8Array(10);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  new DataView(bytes.buffer).setUint16(6, w, true);
  new DataView(bytes.buffer).setUint16(8, h, true);
  return bytes;
};

const jpeg = (w: number, h: number, leadingSegments = 1) => {
  const parts: number[] = [0xff, 0xd8];
  for (let index = 0; index < leadingSegments; index += 1) {
    // An APP0 segment of six bytes, to prove the walk skips what is not a frame.
    parts.push(0xff, 0xe0, 0x00, 0x06, 0, 0, 0, 0);
  }
  parts.push(0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff);
  return new Uint8Array([...parts, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
};

const webpLossy = (w: number, h: number) => {
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x20], 12);
  new DataView(bytes.buffer).setUint16(26, w, true);
  new DataView(bytes.buffer).setUint16(28, h, true);
  return bytes;
};

describe('readImageMeta', () => {
  it('reads the size out of each format a browser can hand over', () => {
    expect(readImageMeta(png(1600, 1200))).toMatchObject({
      width: 1600,
      height: 1200,
      contentType: 'image/png',
      extension: 'png',
    });
    expect(readImageMeta(gif(320, 240))).toMatchObject({ width: 320, height: 240 });
    expect(readImageMeta(webpLossy(800, 600))).toMatchObject({ width: 800, height: 600 });
  });

  it('walks past a JPEG’s other segments to find the frame header', () => {
    expect(readImageMeta(jpeg(4032, 3024))).toMatchObject({
      width: 4032,
      height: 3024,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(readImageMeta(jpeg(640, 480, 4))).toMatchObject({ width: 640, height: 480 });
  });

  it('refuses anything it cannot read, and sizes that cannot be real', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(() => readImageMeta(pdf)).toThrow(InvalidOperationError);
    expect(() => readImageMeta(new Uint8Array(4))).toThrow(InvalidOperationError);
    expect(() => readImageMeta(png(0, 100))).toThrow(InvalidOperationError);
    expect(() => readImageMeta(png(50_000, 50_000))).toThrow(InvalidOperationError);
  });
});
