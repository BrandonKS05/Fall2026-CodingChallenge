import { LayoutGridIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

/** Board list and creation land in the collections unit. */
export default function BoardsPage() {
  return (
    <>
      <PageHeader title="My boards" description="Everything you have saved, organized your way." />
      <EmptyState
        icon={<LayoutGridIcon />}
        title="No boards yet"
        description="Create a board to start saving images into it."
      />
    </>
  );
}
