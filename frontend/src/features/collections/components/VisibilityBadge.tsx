import type { CollectionVisibility } from '@wumboo/shared';
import { Badge } from '@/components/ui/badge';
import { VISIBILITY } from '../visibility';

export function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  const { label, Icon } = VISIBILITY[visibility];
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
