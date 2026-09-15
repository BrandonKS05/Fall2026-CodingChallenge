/**
 * Settings: the person's own name and bio, the account they signed up with,
 * and the one irreversible action, deleting the account. The whole page runs on
 * the stage's token scope, so the fields match every other page rather than
 * borrowing the app theme's light surfaces.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { bioSchema, displayNameSchema } from '@wumboo/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { StageChrome } from '@/components/common/StageChrome';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useDeleteAccount, useSession, useUpdateProfile } from '../queries';

const profileFormSchema = z.object({ displayName: displayNameSchema, bio: bioSchema });
type ProfileForm = z.infer<typeof profileFormSchema>;
const BIO_LIMIT = 160;

export default function SettingsPage() {
  const { user } = useSession();
  return (
    <div className="stage-surface flex min-h-svh flex-col bg-stage text-stage-ink">
      <StageChrome signedIn position="sticky" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>
        {user && (
          <div className="mt-8 space-y-6">
            <ProfileSection key={user.id + user.displayName + user.bio} user={user} />
            <AccountSection email={user.email} createdAt={user.createdAt} />
            <DangerSection />
          </div>
        )}
      </main>
    </div>
  );
}

/** One panel of the page: a hairline card on the stage, titled in small caps. */
function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stage-ink/15 bg-stage-ink/[0.03] p-6">
      <h2 className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileSection({ user }: { user: { displayName: string; bio: string } }) {
  const update = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ProfileForm>({
    resolver: standardSchemaResolver(profileFormSchema),
    defaultValues: { displayName: user.displayName, bio: user.bio },
  });
  const bio = form.watch('bio');

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync(values);
      toast.success('Profile saved');
      form.reset(values);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not save. Try again.');
    }
  });

  return (
    <Sheet title="Profile">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          id="displayName"
          label="Name"
          autoComplete="name"
          error={form.formState.errors.displayName?.message}
          {...form.register('displayName')}
        />
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="bio">Bio</Label>
            <span className="text-xs text-muted-foreground">
              {bio.length}/{BIO_LIMIT}
            </span>
          </div>
          <Textarea
            id="bio"
            rows={3}
            maxLength={BIO_LIMIT}
            placeholder="A line about what you collect."
            aria-invalid={Boolean(form.formState.errors.bio)}
            {...form.register('bio')}
          />
          {form.formState.errors.bio && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.bio.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Shown on your page under your name.</p>
        </div>
        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={update.isPending || !form.formState.isDirty}>
          {update.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Sheet>
  );
}

function AccountSection({ email, createdAt }: { email: string; createdAt: string }) {
  return (
    <Sheet title="Account">
      <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{email}</dd>
        <dt className="text-muted-foreground">Member since</dt>
        <dd>{new Date(createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</dd>
      </dl>
    </Sheet>
  );
}

function DangerSection() {
  const [open, setOpen] = useState(false);
  const remove = useDeleteAccount();
  const navigate = useNavigate();

  return (
    <Sheet title="Danger zone">
      <p className="text-sm text-muted-foreground">
        Deleting your account removes your boards, everything you saved, your likes, and your
        notifications. There is no undo.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your boards, saves, likes, and notifications go with it, right away and for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync();
                setOpen(false);
                toast.success('Your account is gone. Take care.');
                void navigate('/', { replace: true });
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete for good'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
