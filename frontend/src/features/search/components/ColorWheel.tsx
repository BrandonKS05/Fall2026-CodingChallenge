import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * A hue-and-saturation wheel with a hex field beside it. Dragging moves the dot
 * and shows the colour immediately; the value only leaves after a short pause,
 * so a drag across the wheel is one search rather than two hundred.
 */
const SETTLE_MS = 250;

export function ColorWheel({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (hex: string | undefined) => void;
}) {
  const [hex, setHex] = useState(value ?? '#4f46e5');
  const [dragging, setDragging] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const settled = useRef(hex);

  // The pause: the picked colour only becomes a search once the hand stops.
  useEffect(() => {
    if (hex === settled.current) return;
    const timer = setTimeout(() => {
      settled.current = hex;
      onChange(hex);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hex, onChange]);

  const pickFrom = (event: { clientX: number; clientY: number }) => {
    const box = wheel.current?.getBoundingClientRect();
    if (!box) return;
    const radius = box.width / 2;
    const x = event.clientX - box.left - radius;
    const y = event.clientY - box.top - radius;
    // Angle around the wheel is the hue; distance from the middle is saturation.
    const hue = (Math.atan2(y, x) * (180 / Math.PI) + 450) % 360;
    const saturation = Math.min(1, Math.hypot(x, y) / radius);
    setHex(hslToHex(hue, saturation, 0.5));
  };

  const { hue, saturation } = hexToHsl(hex);
  const angle = ((hue - 90) * Math.PI) / 180;
  const dotLeft = 50 + Math.cos(angle) * saturation * 50;
  const dotTop = 50 + Math.sin(angle) * saturation * 50;

  return (
    <div className="flex items-center gap-4">
      <div
        ref={wheel}
        role="application"
        aria-label="Colour wheel"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          pickFrom(event);
        }}
        onPointerMove={(event) => dragging && pickFrom(event)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative size-28 shrink-0 cursor-crosshair rounded-full"
        style={{
          background:
            'radial-gradient(circle, #fff 0%, transparent 70%), conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${dotLeft}%`, top: `${dotTop}%`, background: hex }}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={hex}
          aria-label="Colour, as hex"
          spellCheck={false}
          maxLength={7}
          onChange={(event) => {
            const typed = event.target.value.startsWith('#')
              ? event.target.value
              : `#${event.target.value}`;
            setHex(typed);
          }}
          className="h-9 font-mono"
        />
        <button
          type="button"
          onClick={() => {
            settled.current = '';
            onChange(undefined);
          }}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Any colour
        </button>
      </div>
    </div>
  );
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const [r, g, b] = (
    [
      [chroma, secondary, 0],
      [secondary, chroma, 0],
      [0, chroma, secondary],
      [0, secondary, chroma],
      [secondary, 0, chroma],
      [chroma, 0, secondary],
    ] as [number, number, number][]
  )[Math.floor(hue / 60) % 6] ?? [0, 0, 0];
  const byte = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function hexToHsl(hex: string): { hue: number; saturation: number } {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '4f46e5';
  const [r, g, b] = [0, 2, 4].map((at) => Number.parseInt(clean.slice(at, at + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0 };

  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const lightness = (max + min) / 2;
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: delta / (1 - Math.abs(2 * lightness - 1)),
  };
}
