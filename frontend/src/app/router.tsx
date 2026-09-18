/**
 * Route table. Pages are lazy so each feature ships as its own chunk, and
 * cross-feature composition happens only here and in the shell.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { createBrowserRouter, Outlet, useLocation } from 'react-router';
import { AuthDialogProvider } from './AuthDialogProvider';
import { WumboAI } from '@/features/assistant';
import { InterestOnboarding } from '@/features/recommendations';
import { AuthRoute } from '@/features/auth/pages/AuthRoute';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { RequireAuth, useSession } from '@/features/auth';

const LandingPage = lazy(() => import('@/features/landing/pages/LandingPage'));
const BoardsPage = lazy(() => import('@/features/collections/pages/BoardsPage'));
const BoardPage = lazy(() => import('@/features/collections/pages/BoardPage'));
const ExplorePage = lazy(() => import('@/features/collections/pages/ExplorePage'));
const SharedBoardPage = lazy(() => import('@/features/sharing/pages/SharedBoardPage'));
const SettingsPage = lazy(() => import('@/features/auth/pages/SettingsPage'));
const MessagesPage = lazy(() => import('@/features/messaging/pages/MessagesPage'));
const ProfilePage = lazy(() => import('@/features/social/pages/ProfilePage'));
const CategoryPage = lazy(() => import('@/features/search/pages/CategoryPage'));

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
        initial={{ opacity: 0, filter: 'blur(5px)', scale: 1.06 }}
        animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
        exit={{ opacity: 0, filter: 'blur(6px)', scale: 0.98 }}
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

/**
 * Whether the interests step is still owed is a fact about the session, and
 * the session belongs to auth. Composing the two is the app's job, which is
 * why the question is asked here and not inside the feature.
 */
function OnboardingGate() {
  const { user } = useSession();
  if (!user || user.onboardedAt !== null) return null;
  return <InterestOnboarding />;
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
        {/* Floats over every page; it holds its own state and its own service. */}
        <WumboAI />
        {/* Over everything, including the landing hero: the one thing a brand
            new account is asked before it goes anywhere. */}
        <OnboardingGate />
      </AuthDialogProvider>
    ),
    children: [
      // The landing hero owns the whole viewport and its own chrome, so it sits outside the shell.
      { path: '/', element: page(<LandingPage />) },
      { path: '/explore', element: page(<ExplorePage />) },
      { path: '/c/:name', element: page(<CategoryPage />) },
      { path: '/boards', element: <RequireAuth>{page(<BoardsPage />)}</RequireAuth> },
      { path: '/settings', element: <RequireAuth>{page(<SettingsPage />)}</RequireAuth> },
      { path: '/settings/:section', element: <RequireAuth>{page(<SettingsPage />)}</RequireAuth> },
      // A profile is readable signed out — blurred, with a way in.
      { path: '/u/:handle', element: page(<ProfilePage />) },
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
          // Board pages are readable by non-members when unlisted or public, so the API decides, not the router.
          { path: '/boards/:id', element: page(<BoardPage />) },
          { path: '/s/:slug', element: page(<SharedBoardPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
