/**
 * Reading a picture the browser already has.
 *
 * The photo library indexes by words and by colour, not by likeness, so there
 * is no honest way to ask it "find me this picture". What can be done is read
 * the picture's own colour and shape and search for those — which finds images
 * that feel like it, and says so plainly rather than promising more.
 *
 * Nothing leaves the browser: the file is drawn to a canvas here and never
 * uploaded anywhere.
 */
export interface ImageReading {
  hex: string;
  orientation: 'horizontal' | 'vertical' | 'all';
}

/** Small enough that a large photo costs nothing to read, big enough to be representative. */
const SAMPLE_EDGE = 48;

export async function readImage(file: File): Promise<ImageReading> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_EDGE;
    canvas.height = SAMPLE_EDGE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No 2d context');
    context.drawImage(bitmap, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
    const { data } = context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE);

    return {
      hex: dominantColor(data),
      orientation:
        bitmap.width > bitmap.height * 1.15
          ? 'horizontal'
          : bitmap.height > bitmap.width * 1.15
            ? 'vertical'
            : 'all',
    };
  } finally {
    bitmap.close();
  }
}

/**
 * The most common colour, not the average: averaging a sunset with a shadow
 * gives mud. Pixels are binned coarsely so near-identical shades count together,
 * and near-white and near-black are skipped — almost every photo has plenty of
 * both, and neither says anything about what the picture is of.
 */
function dominantColor(pixels: Uint8ClampedArray): string {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let at = 0; at < pixels.length; at += 4) {
    const [r, g, b, alpha] = [pixels[at]!, pixels[at + 1]!, pixels[at + 2]!, pixels[at + 3]!];
    if (alpha < 128) continue;
    const brightness = (r + g + b) / 3;
    if (brightness > 235 || brightness < 25) continue;

    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bins.set(key, { count: bin.count + 1, r: bin.r + r, g: bin.g + g, b: bin.b + b });
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) {
    if (!best || bin.count > best.count) best = bin;
  }
  if (!best) return '#808080';

  const channel = (total: number) =>
    Math.round(total / best.count)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(best.r)}${channel(best.g)}${channel(best.b)}`;
}
