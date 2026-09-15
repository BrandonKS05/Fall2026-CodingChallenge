import { isRouteErrorResponse, useRouteError } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { buttonVariants } from '@/components/ui/button';

/** Catches render errors below the root route so a crash shows a calm page instead of a stack trace. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <EmptyState
        title="Something broke"
        description={message}
        action={
          <a href="/" className={buttonVariants({ variant: 'outline' })}>
            Reload Wumboo
          </a>
        }
      />
    </div>
  );
}
