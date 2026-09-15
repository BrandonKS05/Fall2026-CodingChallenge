import { ExploreCanvas } from '../components/ExploreCanvas';
import { useSession } from '@/features/auth';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  return <ExploreCanvas signedIn={user !== null} />;
}
