import { mutedTagSchema } from '@wumboo/shared';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePreferences } from './usePreferences';
import { Card, Panel } from './Panel';

const TAG_LIMIT = 20;

export function ContentSection() {
  const { preferences, save } = usePreferences();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!preferences) return null;

  const muted = preferences.mutedTags;
  const full = muted.length >= TAG_LIMIT;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const parsed = mutedTagSchema.safeParse(draft);
    if (!parsed.success) {
      setError('A tag is one word or phrase, up to 30 characters.');
      return;
    }
    if (muted.includes(parsed.data)) {
      setError(`${parsed.data} is already muted.`);
      return;
    }
    setError(null);
    setDraft('');
    save({ mutedTags: [...muted, parsed.data] });
  };

  return (
    <Panel
      title="Content"
      description="Steer what turns up while you are looking around. This only changes what you see."
    >
      <Card>
        <form onSubmit={add} className="space-y-2">
          <Label htmlFor="muted-tag">Muted tags</Label>
          <div className="flex gap-2">
            <Input
              id="muted-tag"
              value={draft}
              disabled={full}
              placeholder="neon"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby="muted-tag-hint"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={full || draft.trim() === ''}>
              Mute
            </Button>
          </div>
          <p id="muted-tag-hint" className="text-xs text-muted-foreground">
            {full
              ? `That is all ${TAG_LIMIT}. Unmute something to make room.`
              : 'Images carrying a muted tag stay out of search and out of the Explore feed.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        {muted.length > 0 && (
          <ul aria-label="Muted tags" className="mt-4 flex flex-wrap gap-2">
            {muted.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  aria-label={`Unmute ${tag}`}
                  onClick={() => save({ mutedTags: muted.filter((kept) => kept !== tag) })}
                  className="flex items-center gap-1.5 rounded-full border border-stage-ink/20 py-1 pr-2 pl-3 text-sm transition-colors hover:border-stage-ink/40"
                >
                  {tag}
                  <XIcon className="size-3.5 opacity-60" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex gap-3">
          <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-stage-ink/50" aria-hidden />
          <div>
            <h3 className="text-sm font-medium">Safe search stays on</h3>
            <p className="mt-0.5 text-sm text-stage-ink/55">
              Every search asks the image provider to leave out anything it marks as unsafe, and
              that is not something an account can turn off here.
            </p>
          </div>
        </div>
      </Card>
    </Panel>
  );
}
