import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/**
 * A person's name, wherever it appears, as a way to their profile. One component
 * so every byline behaves the same: underlines on hover, and goes somewhere.
 */
export function ProfileLink({
  handle,
  children,
  className,
}: {
  handle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={`/u/${handle}`}
      className={cn('underline-offset-4 transition-colors hover:underline', className)}
    >
      {children}
    </Link>
  );
}
