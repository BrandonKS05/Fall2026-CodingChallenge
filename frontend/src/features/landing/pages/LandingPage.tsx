import { useSession } from '@/features/auth';
import { MessagesLink } from '@/features/messaging';
import { NotificationBell } from '@/features/notifications';
import { ExploreCanvas } from '../components/ExploreCanvas';

/** Full-viewport hero with its own chrome; the app shell starts on the next click. */
export default function LandingPage() {
  const { user } = useSession();
  return (
    <ExploreCanvas
      signedIn={user !== null}
      chromeLeading={
        <span className="stage-surface flex items-center gap-1">
          <NotificationBell user={user} />
          <MessagesLink signedIn={user !== null} />
        </span>
      }
    />
  );
}
