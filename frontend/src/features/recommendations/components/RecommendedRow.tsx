/**
 * "You may like": the only part of the app with an opinion about who is
 * looking. Signed out there is nothing to have an opinion from, so it is not
 * rendered at all rather than shown empty.
 */
import { imageTitle } from '@wumboo/shared';
import { StageButton } from '@/components/common/StageButton';
import { cn } from '@/lib/utils';
import { useRecommendations } from '../queries';

export interface RecommendedRowProps {
  /** Only a member has a profile to recommend from. */
  signedIn: boolean;
  /** Opens the board a picture sits on, in the carousel, where it was found. */
  onOpen: (collectionId: string) => void;
  className?: string;
}

export function RecommendedRow({ signedIn, onOpen, className }: RecommendedRowProps) {
  const feed = useRecommendations(signedIn);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  // Nothing to say yet: a new account with no public boards to draw on. The
  // asking happens once at sign-up, not here.
  if (!signedIn || (!feed.isPending && items.length === 0)) return null;

  return (
    <section aria-label="You may like" className={cn('text-stage-ink', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-lg font-medium">You may like</h2>
        <p className="text-xs tracking-[0.2em] text-stage-ink/50 uppercase">From what you save</p>
      </div>

      {feed.isPending ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="aspect-4/3 animate-pulse rounded-lg bg-stage-ink/10" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.collection.id)}
                className="group block w-full text-left"
                aria-label={`${item.caption || imageTitle(item.image.tags) || 'Untitled'}, on ${item.collection.title}`}
              >
                <img
                  src={item.image.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-4/3 w-full rounded-lg bg-stage-ink/10 object-cover transition-transform group-hover:scale-[1.02]"
                />
                <span className="mt-1.5 block truncate text-xs text-stage-ink/70">
                  {item.collection.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {feed.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <StageButton
            variant="outline"
            disabled={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            {feed.isFetchingNextPage ? 'Looking…' : 'More like this'}
          </StageButton>
        </div>
      )}
    </section>
  );
}
