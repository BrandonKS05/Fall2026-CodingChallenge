/**
 * Settings, as a list of sections down the left and one panel on the right.
 * The section lives in the URL (/settings/privacy), so a link can point at one
 * and the back button behaves. Everything runs on the stage's token scope, so
 * the controls match the rest of the app rather than the light app theme.
 */
import { NavLink, useParams } from 'react-router';
import { StageChrome } from '@/components/common/StageChrome';
import { cn } from '@/lib/utils';
import { AccountManagementSection } from '../components/settings/AccountManagementSection';
import { AccountSection } from '../components/settings/AccountSection';
import { ContentSection } from '../components/settings/ContentSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { PrivacySection } from '../components/settings/PrivacySection';
import { SecuritySection } from '../components/settings/SecuritySection';
import { useSession } from '../queries';

const SECTIONS = [
  'account',
  'privacy',
  'notifications',
  'content',
  'security',
  'account-management',
] as const;
type Section = (typeof SECTIONS)[number];

const LABELS: Record<Section, string> = {
  account: 'Account',
  privacy: 'Privacy',
  notifications: 'Notifications',
  content: 'Content',
  security: 'Security',
  'account-management': 'Account management',
};

const isSection = (value: string | undefined): value is Section =>
  SECTIONS.includes(value as Section);

export default function SettingsPage() {
  const { user } = useSession();
  const params = useParams();
  const section: Section = isSection(params.section) ? params.section : 'account';

  return (
    <div className="stage-surface flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome signedIn position="sticky" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>

        <div className="mt-8 grid gap-8 md:grid-cols-[14rem_1fr] md:gap-12">
          {/* min-w-0 keeps the scroller from setting the column's width: without it the
              six no-wrap items make this track ~600px and the whole page overflows. */}
          <nav aria-label="Settings sections" className="min-w-0 md:sticky md:top-24 md:self-start">
            <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 md:flex-col md:overflow-visible md:pb-0">
              {SECTIONS.map((id) => (
                <li key={id}>
                  <NavLink
                    to={`/settings/${id}`}
                    end
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                        isActive || (id === 'account' && section === 'account')
                          ? 'bg-stage-ink/10 font-semibold text-stage-ink'
                          : 'text-stage-ink/60 hover:bg-stage-ink/5 hover:text-stage-ink',
                      )
                    }
                  >
                    {LABELS[id]}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {user && (
            <div className="min-w-0">
              {section === 'account' && <AccountSection user={user} />}
              {section === 'privacy' && <PrivacySection handle={user.handle} />}
              {section === 'notifications' && <NotificationsSection />}
              {section === 'content' && <ContentSection />}
              {section === 'security' && <SecuritySection />}
              {section === 'account-management' && <AccountManagementSection />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
