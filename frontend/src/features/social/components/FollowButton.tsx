import type { PublicProfile } from '@wumboo/shared';
import { StageButton } from '@/components/common/StageButton';
import { useAuthDialog } from '@/hooks/useAuthDialog';
import { useFollow } from '../queries';

/** Follow, Following, and the sign-in card for anyone not yet signed in. */
export function FollowButton({ profile, signedIn }: { profile: PublicProfile; signedIn: boolean }) {
  const follow = useFollow(profile.handle);
  const auth = useAuthDialog();
  if (profile.isViewer) return null;

  const following = profile.followedByViewer;
  return (
    <StageButton
      variant={following ? 'outline' : 'solid'}
      disabled={follow.isPending}
      aria-pressed={following}
      onClick={() => {
        if (!signedIn) auth.open({ mode: 'login' });
        else follow.mutate(!following);
      }}
    >
      {following ? 'Following' : 'Follow'}
    </StageButton>
  );
}
