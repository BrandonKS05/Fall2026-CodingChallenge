import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Nothing here"
      description="That page does not exist, or the link has been revoked."
      action={
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          Back to Discover
        </Link>
      }
    />
  );
}
