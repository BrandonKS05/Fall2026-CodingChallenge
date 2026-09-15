import { ExploreCanvas } from '@/components/explore/ExploreCanvas';
import { useSession } from '@/features/auth/queries';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  return <ExploreCanvas signedIn={user !== null} />;
}
