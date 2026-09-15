import type { SearchCategory } from '@wumboo/shared';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { CATEGORIES } from '../categories';

/**
 * Categories as tiles on the stage: a colour wash and the name, in the same
 * uppercase the rest of the page is set in. No borrowed cover photos — the
 * pictures are what you get after you click.
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
  return (
    <section aria-label={heading} className={className}>
      <h2 className="border-b border-stage-ink/20 pb-3 text-[11px] tracking-[0.2em] text-stage-ink/60 uppercase">
        {heading}
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category) => {
          const look = CATEGORIES[category];
          return (
            <li key={category}>
              <Link
                to={`/c/${category}`}
                className="group relative flex h-28 items-end overflow-hidden rounded-xl p-3 ring-1 ring-stage-ink/10 transition-transform hover:-translate-y-0.5 sm:h-32"
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-0 bg-linear-to-br transition-opacity group-hover:opacity-90',
                    look.from,
                    look.to,
                  )}
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-stage/80 via-stage/10 to-transparent"
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
