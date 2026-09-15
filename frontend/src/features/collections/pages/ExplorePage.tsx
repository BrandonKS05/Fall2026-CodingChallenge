import { ArrowRightIcon } from 'lucide-react';
import { http } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useExplore } from '../queries';

const TILE_CLASSES = [
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-2',
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-2',
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-1',
  'sm:col-span-2',
] as const;

export default function ExplorePage() {
  const boards = useExplore();

  const images =
    boards.data
      ?.flatMap((board) =>
        board.previewImageIds.slice(0, 2).map((imageId) => ({
          id: imageId,
          title: board.title,
        })),
      )
      .filter((image) => image.id)
      .slice(0, 12) ?? [];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f1efe1] text-[#111111]">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-end justify-between gap-6 pb-4">
          <div>
            <h1 className="text-[clamp(3rem,7vw,7rem)] leading-[0.8] font-black tracking-[-0.08em] uppercase">
              Explore
            </h1>
            <p className="mt-2 text-sm text-[#111111]/70">
              Public boards from everyone on Wumboo, newest first.
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="h-5 w-5 rounded-full bg-[#111111]" />
          </div>
        </div>

        <div className="h-px w-full bg-[#111111]/30" />

        {boards.isPending ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className={cn(
                  'animate-pulse rounded-xl bg-[#d9d5c8]',
                  index % 3 === 0
                    ? 'aspect-[4/5]'
                    : index % 3 === 1
                      ? 'aspect-[3/4]'
                      : 'aspect-[5/4]',
                )}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {images.map((image, index) => (
              <div
                key={`${image.id}-${index}`}
                className={cn(
                  'overflow-hidden rounded-xl border border-black/5 bg-[#d9d5c8] shadow-sm',
                  TILE_CLASSES[index % TILE_CLASSES.length],
                  index % 2 === 0 ? 'aspect-[4/5]' : 'aspect-[3/4]',
                )}
              >
                <img
                  src={http.url(`/images/${image.id}`)}
                  alt={image.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-4">
          <button className="inline-flex items-center gap-2 border border-[#111111]/30 bg-transparent px-4 py-3 text-[11px] tracking-[0.22em] uppercase transition-colors hover:bg-[#111111] hover:text-[#f1efe1]">
            See more work <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
