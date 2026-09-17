/**
 * The second half of signing up: the six digits that prove the address or the
 * number belongs to whoever typed it. A phone number nobody has used before
 * also needs a name and a handle, which are asked for here — after the code,
 * never before, so nothing is collected from someone who cannot be reached.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  displayNameSchema,
  handleSchema,
  verificationCodeSchema,
  type AuthOutcome,
  type VerificationChannel,
} from '@wumboo/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useSendCode, useVerifyCode } from '../queries';

/**
 * Two shapes for one form: the name and handle are only real fields once the
 * code has proved a number nobody has used, and until then they must not be
 * validated — an empty box the person cannot see is not an error.
 */
const codeOnlySchema = z.object({
  code: verificationCodeSchema,
  handle: z.string(),
  displayName: z.string(),
});
const withProfileSchema = z.object({
  code: verificationCodeSchema,
  handle: handleSchema,
  displayName: displayNameSchema,
});
type CodeValues = z.infer<typeof codeOnlySchema>;

const resolvers = {
  code: standardSchemaResolver<CodeValues, unknown, CodeValues>(codeOnlySchema),
  profile: standardSchemaResolver<CodeValues, unknown, CodeValues>(withProfileSchema),
};

export interface PendingCode {
  channel: VerificationChannel;
  /** The address or number the code went to; shown so a typo is obvious. */
  target: string;
  resendAfterSeconds: number;
  /** True once the code has proved a number that has no account yet. */
  needsProfile?: boolean;
}

export function CodeStep({
  pending,
  onPending,
  onSignedIn,
  onBack,
}: {
  pending: PendingCode;
  /** Carries the outcome back up: a code still to type, or a name now wanted. */
  onPending: (next: PendingCode) => void;
  onSignedIn: () => void;
  onBack: () => void;
}) {
  const verify = useVerifyCode();
  const resend = useSendCode();
  const [serverError, setServerError] = useState<string | null>(null);
  const [wait, setWait] = useState(pending.resendAfterSeconds);
  const needsProfile = pending.needsProfile === true;

  const form = useForm<CodeValues>({
    resolver: needsProfile ? resolvers.profile : resolvers.code,
    defaultValues: { code: '', handle: '', displayName: '' },
  });

  // The countdown is the whole explanation for why "Send another" is not a button yet.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const settle = (outcome: AuthOutcome) => {
    if (outcome.status === 'signed-in') return onSignedIn();
    if (outcome.status === 'profile-needed') {
      onPending({ ...pending, needsProfile: true });
      return;
    }
    onPending({ ...pending, resendAfterSeconds: outcome.resendAfterSeconds });
    setWait(outcome.resendAfterSeconds);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      settle(
        await verify.mutateAsync({
          ...(pending.channel === 'email'
            ? { channel: 'email' as const, email: pending.target }
            : { channel: 'phone' as const, phone: pending.target }),
          code: values.code,
          ...(needsProfile
            ? { handle: values.handle, displayName: values.displayName }
            : undefined),
        }),
      );
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'That did not work. Try again in a moment.',
      );
    }
  });

  const sendAnother = async () => {
    setServerError(null);
    try {
      const outcome = await resend.mutateAsync(
        pending.channel === 'email'
          ? { channel: 'email', email: pending.target }
          : { channel: 'phone', phone: pending.target },
      );
      if (outcome.status === 'verification-required') setWait(outcome.resendAfterSeconds);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not send another code.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <p className="text-sm text-muted-foreground">
          {pending.channel === 'email' ? 'We emailed a code to' : 'We texted a code to'}{' '}
          <strong className="text-foreground">{pending.target}</strong>. It is good for ten minutes.
        </p>
      </div>

      <FormField
        id="verification-code"
        label="Code"
        error={form.formState.errors.code?.message}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="123456"
        autoFocus
        className="h-11 text-center text-lg tracking-[0.4em]"
        {...form.register('code')}
      />

      {needsProfile && (
        <>
          <p className="text-sm text-muted-foreground">
            That number is new here. What should people call you?
          </p>
          <FormField
            id="phone-display-name"
            label="Name"
            error={form.formState.errors.displayName?.message}
            autoComplete="name"
            {...form.register('displayName')}
          />
          <FormField
            id="phone-handle"
            label="Handle"
            prefix="@"
            autoCapitalize="none"
            error={form.formState.errors.handle?.message}
            hint="Lowercase letters, numbers and underscores. This is how people find you."
            {...form.register('handle')}
          />
        </>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={verify.isPending}>
        {verify.isPending ? 'Checking…' : needsProfile ? 'Create my account' : 'Confirm'}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different {pending.channel === 'email' ? 'address' : 'number'}
        </button>
        <button
          type="button"
          onClick={() => void sendAnother()}
          disabled={wait > 0 || resend.isPending}
          className="font-medium underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {wait > 0 ? `Send another in ${wait}s` : 'Send another'}
        </button>
      </div>
    </form>
  );
}
