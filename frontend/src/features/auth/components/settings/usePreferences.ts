import type { UserPreferences, UserPreferencesPatch } from '@wumboo/shared';
import { toast } from 'sonner';
import { useSession, useUpdateProfile } from '../../queries';

/**
 * Reads the person's settings and writes patches back. Every control here is a
 * switch or a picker, so the cache moves first and the server confirms; a
 * failure puts it back and says so rather than leaving a lie on screen.
 */
export function usePreferences(): {
  preferences: UserPreferences | null;
  save: (patch: UserPreferencesPatch) => void;
} {
  const { user } = useSession();
  const update = useUpdateProfile();

  return {
    preferences: user?.preferences ?? null,
    save: (patch) => {
      update.mutate(
        { preferences: patch },
        { onError: () => toast.error('That setting did not save. Try again.') },
      );
    },
  };
}
