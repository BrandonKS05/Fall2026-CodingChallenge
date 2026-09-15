import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  bioSchema,
  displayNameSchema,
  handleSchema,
  nextHandleChangeAt,
  type User,
} from '@wumboo/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useAuthProviders, useUpdateProfile } from '../../queries';
import { Card, Panel } from './Panel';

const profileFormSchema = z.object({
  displayName: displayNameSchema,
  handle: handleSchema,
  bio: bioSchema,
});
type ProfileForm = z.infer<typeof profileFormSchema>;
const BIO_LIMIT = 160;

export function AccountSection({ user }: { user: User }) {
  return (
    <Panel
      title="Account"
      description="Your name, the handle people find you by, and how you sign in."
    >
      <ProfileCard key={user.displayName + user.handle + user.bio} user={user} />
      <SignInCard user={user} />
    </Panel>
  );
}

function ProfileCard({ user }: { user: User }) {
  const update = useUpdateProfile();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ProfileForm>({
    resolver: standardSchemaResolver(profileFormSchema),
    defaultValues: { displayName: user.displayName, handle: user.handle, bio: user.bio },
  });
  const bio = form.watch('bio');

  // A handle moves once for free; after that it settles, so people stay findable.
  const unlocksAt = nextHandleChangeAt(user.handleChangedAt);
  const settled = unlocksAt !== null && unlocksAt > new Date();

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync(
        settled ? { displayName: values.displayName, bio: values.bio } : values,
      );
      toast.success('Saved');
      form.reset(values);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not save. Try again.');
    }
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          id="displayName"
          label="Name"
          autoComplete="name"
          hint="What people see on your boards. Change it as often as you like."
          error={form.formState.errors.displayName?.message}
          {...form.register('displayName')}
        />
        <FormField
          id="handle"
          label="Handle"
          prefix="@"
          autoCapitalize="off"
          spellCheck={false}
          disabled={settled}
          hint={
            settled && unlocksAt
              ? `Settled until ${unlocksAt.toLocaleDateString(undefined, { dateStyle: 'long' })}.`
              : 'How people find you. Once you change it, it stays put for two weeks.'
          }
          error={form.formState.errors.handle?.message}
          {...form.register('handle')}
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
          <p className="text-xs text-muted-foreground">Sits under your name on your page.</p>
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
          {update.isPending ? 'Saving\u2026' : 'Save profile'}
        </Button>
      </form>
    </Card>
  );
}

function SignInCard({ user }: { user: User }) {
  const providers = useAuthProviders();
  return (
    <Card>
      <h3 className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
        How you sign in
      </h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-muted-foreground">Member since</dt>
        <dd>{new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</dd>
        <dt className="text-muted-foreground">Google</dt>
        <dd className="text-stage-ink/70">
          {providers.data?.google
            ? 'Available on this server. Signing in with Google links it to this email.'
            : 'Not set up on this server.'}
        </dd>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Changing the email on an account is not something Wumboo does yet.
      </p>
    </Card>
  );
}
