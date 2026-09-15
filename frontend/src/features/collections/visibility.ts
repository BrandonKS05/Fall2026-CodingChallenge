import type { CollectionVisibility } from '@wumboo/shared';
import { GlobeIcon, LinkIcon, LockIcon } from 'lucide-react';
import type { ComponentType } from 'react';

/** Labels, explanations, and icons for each visibility, shared by the badge and the picker. */
export const VISIBILITY: Record<
  CollectionVisibility,
  { label: string; description: string; Icon: ComponentType<{ className?: string }> }
> = {
  private: { label: 'Private', description: 'Only members can see this board.', Icon: LockIcon },
  unlisted: { label: 'Link only', description: 'Anyone with the link can view.', Icon: LinkIcon },
  public: { label: 'Public', description: 'Listed on Explore for everyone.', Icon: GlobeIcon },
};
