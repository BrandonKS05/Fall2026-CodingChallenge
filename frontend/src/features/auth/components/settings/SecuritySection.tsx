import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { passwordSchema } from '@wumboo/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordField } from '@/components/common/PasswordField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useChangePassword, useRevokeSessions } from '../../queries';
import { PASSWORD_RULES } from '../../passwordRules';
import { Card, Panel, Row } from './Panel';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Type the password you use now'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Type the new one once more'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Those two do not match',
  });
type PasswordForm = z.infer<typeof passwordFormSchema>;

export function SecuritySection() {
  return (
    <Panel
      title="Security"
      description="Your password, and the sessions it has left open elsewhere."
    >
      <PasswordCard />
      <SessionsCard />
    </Panel>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<PasswordForm>({
    resolver: standardSchemaResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const next = form.watch('newPassword');

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      toast.success('Password changed. Other devices have been signed out.');
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not change it. Try again.');
    }
  });

  return (
    <Card>
      <h3 className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Password</h3>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <PasswordField
          id="currentPassword"
          label="Current password"
          autoComplete="current-password"
          error={form.formState.errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
        <PasswordField
          id="newPassword"
          label="New password"
          autoComplete="new-password"
          error={form.formState.errors.newPassword?.message}
          hint={
            <ul className="space-y-1">
              {PASSWORD_RULES.map((rule) => (
                <li key={rule.label} className={rule.holds(next) ? 'text-stage-ink/80' : undefined}>
                  {rule.holds(next) ? '\u2713' : '\u2022'} {rule.label}
                </li>
              ))}
            </ul>
          }
          {...form.register('newPassword')}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? 'Changing\u2026' : 'Change password'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Signed in with Google and never set a password? Then there is nothing to change here.
        </p>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const revoke = useRevokeSessions();
  return (
    <Card>
      <Row
        label="Sign out everywhere else"
        description="Ends every session but this one. Good after using a shared computer."
        control={
          <Button
            variant="outline"
            disabled={revoke.isPending}
            onClick={() =>
              revoke.mutate(undefined, {
                onSuccess: () => toast.success('Other sessions ended'),
                onError: () => toast.error('Could not end them. Try again.'),
              })
            }
          >
            {revoke.isPending ? 'Ending\u2026' : 'Sign out'}
          </Button>
        }
      />
      <p className="mt-3 border-t border-stage-ink/10 pt-3 text-xs text-muted-foreground">
        Wumboo keeps one signed cookie per browser rather than a list of devices, so there is
        nothing here to name — but ending them all takes a moment.
      </p>
    </Card>
  );
}
