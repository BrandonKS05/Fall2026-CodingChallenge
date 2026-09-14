import { SearchIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/ui/input';

/** Search UI lands in the next unit; the shell, hero, and input are in place. */
export default function DiscoverPage() {
  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-2xl space-y-4 pt-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Find it again.</h1>
        <p className="text-muted-foreground">
          Search millions of free photos, save the ones you love to boards, and share them with people
          who will actually look.
        </p>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Try “warm kitchen”, “fog over pines”, “brutalist library”"
            className="h-11 pl-9 text-base"
            aria-label="Search images"
          />
        </div>
      </section>
      <EmptyState
        icon={<SearchIcon />}
        title="Search results appear here"
        description="Type anything above to start discovering."
      />
    </div>
  );
}
