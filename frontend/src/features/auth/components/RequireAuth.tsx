import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useSession } from '../queries';

/** Route guard. Sends visitors to the login page and brings them back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
