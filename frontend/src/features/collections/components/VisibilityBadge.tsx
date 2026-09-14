import type { CollectionVisibility } from '@trove/shared';
import { GlobeIcon, LinkIcon, LockIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';

export const VISIBILITY: Record<
  CollectionVisibility,
  { label: string; description: string; Icon: ComponentType<{ className?: string }> }
> = {
  private: { label: 'Private', description: 'Only members can see this board.', Icon: LockIcon },
  unlisted: { label: 'Link only', description: 'Anyone with the link can view.', Icon: LinkIcon },
  public: { label: 'Public', description: 'Listed on Explore for everyone.', Icon: GlobeIcon },
};

export function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  const { label, Icon } = VISIBILITY[visibility];
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
