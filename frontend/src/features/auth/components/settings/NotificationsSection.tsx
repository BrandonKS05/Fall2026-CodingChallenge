import type { NotificationPreferences } from '@wumboo/shared';
import { Switch } from '@/components/ui/switch';
import { usePreferences } from './usePreferences';
import { Card, Panel, Row, Rows } from './Panel';

/** Plain language for each kind, in the order they matter to a person. */
const SWITCHES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  {
    key: 'itemAdded',
    label: 'Someone saves to a shared board',
    description: 'The most common one: a new image lands on a board you are part of.',
  },
  {
    key: 'collectionLiked',
    label: 'Someone likes a board of yours',
    description: 'Only for boards you own.',
  },
  {
    key: 'memberAdded',
    label: 'Someone joins a shared board',
    description: 'A new editor or viewer accepts an invitation.',
  },
  {
    key: 'itemUpdated',
    label: 'An image is re-captioned or re-tagged',
    description: 'Quieter than it sounds, unless a board is busy.',
  },
  {
    key: 'itemRemoved',
    label: 'An image is taken off a board',
    description: 'Worth keeping on for boards several people edit.',
  },
  {
    key: 'collectionUpdated',
    label: 'A board is renamed or re-described',
    description: 'Changes to the board itself, not its images.',
  },
];

export function NotificationsSection() {
  const { preferences, save } = usePreferences();
  if (!preferences) return null;

  return (
    <Panel
      title="Notifications"
      description="Pick which moments are worth a mention. A switch that is off means nothing is written at all."
    >
      <Card>
        <Rows>
          {SWITCHES.map(({ key, label, description }) => (
            <Row
              key={key}
              label={label}
              description={description}
              control={
                <Switch
                  aria-label={label}
                  checked={preferences.notifications[key]}
                  onCheckedChange={(next) => save({ notifications: { [key]: next } })}
                />
              }
            />
          ))}
        </Rows>
      </Card>
      <p className="text-xs text-muted-foreground">
        Everything arrives in the bell at the top of the app. Wumboo does not send email or push.
      </p>
    </Panel>
  );
}
