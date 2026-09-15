/**
 * Route table. Pages are lazy so each feature ships as its own chunk, and
 * cross-feature composition happens only here and in the shell.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AuthRoute } from './AuthRoute';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';
import { PageSkeleton } from '@/components/common/PageSkeleton';

const LandingPage = lazy(() => import('./LandingPage'));
const DiscoverPage = lazy(() => import('@/features/search/pages/DiscoverPage'));
const BoardsPage = lazy(() => import('@/features/collections/pages/BoardsPage'));
const BoardPage = lazy(() => import('@/features/collections/pages/BoardPage'));
const ExplorePage = lazy(() => import('@/features/collections/pages/ExplorePage'));
const SharedBoardPage = lazy(() => import('@/features/sharing/pages/SharedBoardPage'));

function page(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    // One sign-in dialog for the whole app: any page, including the landing hero, opens it in place.
    errorElement: <RouteErrorPage />,
    element: (
      <AuthDialogProvider>
        <Outlet />
      </AuthDialogProvider>
    ),
    children: [
      // The landing hero owns the whole viewport and its own chrome, so it sits outside the shell.
      { path: '/', element: page(<LandingPage />) },
      {
        errorElement: <RouteErrorPage />,
        element: (
          <AppShell>
            <Outlet />
          </AppShell>
        ),
        children: [
          { path: '/discover', element: page(<DiscoverPage />) },
          { path: '/explore', element: page(<ExplorePage />) },
          // Board pages are readable by non-members when unlisted or public, so the API decides, not the router.
          { path: '/boards/:id', element: page(<BoardPage />) },
          { path: '/s/:slug', element: page(<SharedBoardPage />) },
          // Sign-in as a URL, for deep links and Google's return trip; the card floats over Explore.
          { path: '/login', element: <AuthRoute mode="login" /> },
          { path: '/register', element: <AuthRoute mode="register" /> },
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
    ],
  },
]);
