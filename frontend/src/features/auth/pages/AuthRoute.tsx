import { lazy, Suspense, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useAuthDialog, type AuthMode } from '@/hooks/useAuthDialog';

const ExplorePage = lazy(() => import('@/features/collections/pages/ExplorePage'));

/**
 * /login and /register as URLs: Google's return trip, the route guard, and typed
 * links all land here. Explore renders underneath so the card still floats over
 * real content, and dismissing it simply leaves the visitor on Explore.
 */
export function AuthRoute({ mode }: { mode: AuthMode }) {
  const { open, close } = useAuthDialog();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/boards';

  useEffect(() => {
    open({ mode, from, onDismiss: () => void navigate('/explore', { replace: true }) });
    return close;
  }, [mode, from, open, close, navigate]);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <ExplorePage />
    </Suspense>
  );
}
