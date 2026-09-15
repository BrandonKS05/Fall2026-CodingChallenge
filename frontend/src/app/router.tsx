/**
 * Route table. Pages are lazy so each feature ships as its own chunk, and
 * cross-feature composition happens only here and in the shell.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createBrowserRouter, Outlet, useLocation } from 'react-router';
import { AuthDialogProvider } from './AuthDialogProvider';
import { AuthRoute } from '@/features/auth/pages/AuthRoute';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { RequireAuth } from '@/features/auth';

const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));
const DiscoverPage = lazy(() => import('@/features/search/pages/DiscoverPage'));
const BoardsPage = lazy(() => import('@/features/collections/pages/BoardsPage'));
const BoardPage = lazy(() => import('@/features/collections/pages/BoardPage'));
const ExplorePage = lazy(() => import('@/features/collections/pages/ExplorePage'));
const SharedBoardPage = lazy(() => import('@/features/sharing/pages/SharedBoardPage'));
const SettingsPage = lazy(() => import('@/features/auth/pages/SettingsPage'));
const MessagesPage = lazy(() => import('@/features/messaging/pages/MessagesPage'));

function page(element: ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;
}

/**
 * Pages animate on arrival, but a page with sections of its own keeps one key
 * across them: moving between settings sections is moving inside a page, not
 * arriving at a new one, so it should not blur and re-enter.
 */
function transitionKey(pathname: string): string {
  for (const section of ['/settings', '/messages']) {
    if (pathname.startsWith(section)) return section;
  }
  return pathname;
}

function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  if (location.pathname === '/') {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey(location.pathname)}
        initial={{ opacity: 0, filter: 'blur(14px)', scale: 1.14 }}
        animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
        exit={{ opacity: 0, filter: 'blur(18px)', scale: 0.96 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        // Full height, never a scroll container: sticky chrome and filters rely on the document scrolling.
        className="min-h-svh w-full overflow-x-clip"
        style={{ willChange: 'transform, opacity, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export const router = createBrowserRouter([
  {
    // One sign-in dialog for the whole app: any page, including the landing hero, opens it in place.
    errorElement: <RouteErrorPage />,
    element: (
      <AuthDialogProvider>
        <RouteTransition>
          <Outlet />
        </RouteTransition>
      </AuthDialogProvider>
    ),
    children: [
      // The landing hero owns the whole viewport and its own chrome, so it sits outside the shell.
      { path: '/', element: page(<LandingPage />) },
      { path: '/explore', element: page(<ExplorePage />) },
      { path: '/boards', element: <RequireAuth>{page(<BoardsPage />)}</RequireAuth> },
      { path: '/settings', element: <RequireAuth>{page(<SettingsPage />)}</RequireAuth> },
      { path: '/settings/:section', element: <RequireAuth>{page(<SettingsPage />)}</RequireAuth> },
      { path: '/messages', element: <RequireAuth>{page(<MessagesPage />)}</RequireAuth> },
      { path: '/messages/:id', element: <RequireAuth>{page(<MessagesPage />)}</RequireAuth> },
      // Sign-in as a URL, for deep links and Google's return trip; the card floats over Explore.
      { path: '/login', element: <AuthRoute mode="login" /> },
      { path: '/register', element: <AuthRoute mode="register" /> },
      {
        errorElement: <RouteErrorPage />,
        element: (
          <AppShell>
            <Outlet />
          </AppShell>
        ),
        children: [
          { path: '/discover', element: page(<DiscoverPage />) },
          // Board pages are readable by non-members when unlisted or public, so the API decides, not the router.
          { path: '/boards/:id', element: page(<BoardPage />) },
          { path: '/s/:slug', element: page(<SharedBoardPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
