import { useSession } from '@/features/auth';
import { MessagesLink } from '@/features/messaging';
import { ExploreCanvas } from '../components/ExploreCanvas';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  return (
    <ExploreCanvas
      signedIn={user !== null}
      chromeLeading={<MessagesLink signedIn={user !== null} />}
    />
  );
}
