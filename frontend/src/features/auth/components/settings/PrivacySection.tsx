import { collectionVisibilitySchema, type CollectionVisibility } from '@wumboo/shared';
import { DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { authApi } from '../../api';
import { usePreferences } from './usePreferences';
import { Card, Panel, Row, Rows } from './Panel';

const SHORT_LABEL: Record<CollectionVisibility, string> = {
  private: 'Private',
  unlisted: 'Link only',
  public: 'Public',
};

const WHAT_IT_MEANS: Record<CollectionVisibility, string> = {
  private: 'Private: only you, and anyone you invite to that board.',
  unlisted: 'Link only: nobody finds it by browsing, but the link always opens it.',
  public: 'Public: anyone can open it, and it can turn up in Explore.',
};

export function PrivacySection({ handle }: { handle: string }) {
  const { preferences, save } = usePreferences();
  if (!preferences) return null;

  return (
    <Panel
      title="Privacy"
      description="Who comes across your boards, and how to take your things with you."
    >
      <Card>
        <Rows>
          <Row
            label="Turn up in Explore"
            description="Off keeps your public boards open to anyone holding the link, but out of the Explore feed."
            control={
              <Switch
                checked={preferences.discoverable}
                onCheckedChange={(next) => save({ discoverable: next })}
                aria-label="Turn up in Explore"
              />
            }
          />
          <Row
            label="New boards start as"
            description="Every board still has its own setting; this is only what a new one opens with."
            control={
              <Select
                value={preferences.defaultBoardVisibility}
                onValueChange={(next) =>
                  save({ defaultBoardVisibility: collectionVisibilitySchema.parse(next) })
                }
              >
                <SelectTrigger className="w-40" aria-label="New boards start as">
                  {SHORT_LABEL[preferences.defaultBoardVisibility]}
                </SelectTrigger>
                <SelectContent>
                  {collectionVisibilitySchema.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {SHORT_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </Rows>
        <p className="mt-4 border-t border-stage-ink/10 pt-4 text-xs text-muted-foreground">
          {WHAT_IT_MEANS[preferences.defaultBoardVisibility]}
        </p>
      </Card>

      <Card>
        <Row
          label="Take a copy of everything"
          description="Your profile, your settings, your boards, and every image you have saved, as one JSON file."
          control={<DownloadButton handle={handle} />}
        />
      </Card>
    </Panel>
  );
}

/** Builds the file in the page: the same data the endpoint serves, saved under a name we choose. */
function DownloadButton({ handle }: { handle: string }) {
  const [working, setWorking] = useState(false);

  const download = async () => {
    setWorking(true);
    try {
      const data = await authApi.exportAccount();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `wumboo-${handle}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Your copy is downloading');
    } catch {
      toast.error('Could not put that file together. Try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Button variant="outline" onClick={() => void download()} disabled={working}>
      <DownloadIcon className="size-4" />
      {working ? 'Gathering\u2026' : 'Download'}
    </Button>
  );
}
