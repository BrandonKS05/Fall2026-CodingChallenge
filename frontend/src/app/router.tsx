/**
 * Route table. Pages are lazy so each feature ships as its own chunk, and
 * cross-feature composition happens only here and in the shell.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';
import { PageSkeleton } from '@/components/common/PageSkeleton';

const DiscoverPage = lazy(() => import('@/features/search/pages/DiscoverPage'));
const BoardsPage = lazy(() => import('@/features/collections/pages/BoardsPage'));
const BoardPage = lazy(() => import('@/features/collections/pages/BoardPage'));
const ExplorePage = lazy(() => import('@/features/collections/pages/ExplorePage'));
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));

function page(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    children: [
      { path: '/', element: page(<DiscoverPage />) },
      { path: '/explore', element: page(<ExplorePage />) },
      // Board pages are readable by non-members when unlisted or public, so the API decides, not the router.
      { path: '/boards/:id', element: page(<BoardPage />) },
      { path: '/login', element: page(<LoginPage />) },
      { path: '/register', element: page(<RegisterPage />) },
      {
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [{ path: '/boards', element: page(<BoardsPage />) }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
