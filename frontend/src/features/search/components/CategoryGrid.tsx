import type { SearchCategory } from '@wumboo/shared';
import { Link } from 'react-router';
import { http } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '../categories';
import { useCategoryCovers } from '../queries';

/**
 * Categories as tiles: one picture from inside each, under the category's own
 * colour wash so the grid still reads as one thing on the dark stage. The wash
 * alone is the fallback, so a cover that has not been stored costs nothing.
 */
export function CategoryGrid({
  categories,
  heading,
  className,
}: {
  categories: SearchCategory[];
  heading: string;
  className?: string;
}) {
  const covers = useCategoryCovers();
  const coverOf = new Map((covers.data?.covers ?? []).map((cover) => [cover.category, cover]));

  return (
    <section aria-label={heading} className={className}>
      <h2 className="border-b border-stage-ink/20 pb-3 text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
        {heading}
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category) => {
          const look = CATEGORIES[category];
          const cover = coverOf.get(category);
          return (
            <li key={category}>
              <Link
                to={`/c/${category}`}
                className="group relative flex h-28 items-end overflow-hidden rounded-xl p-3 ring-1 ring-stage-ink/10 transition-transform hover:-translate-y-0.5 sm:h-32"
              >
                <span
                  aria-hidden
                  className={cn('absolute inset-0 bg-linear-to-br', look.from, look.to)}
                />
                {cover && (
                  <img
                    src={http.url(`/images/${cover.imageId}`)}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full scale-100 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                {/* The category's colour, a breath of it, so twenty photos still read as one grid. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-0 bg-linear-to-br opacity-40 mix-blend-color transition-opacity group-hover:opacity-25',
                    look.from,
                    look.to,
                  )}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-stage/90 via-stage/30 to-transparent"
                />
                <span className="relative text-[11px] tracking-[0.2em] text-stage-ink uppercase">
                  {look.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
