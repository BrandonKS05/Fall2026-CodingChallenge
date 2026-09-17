/**
 * The second half of signing up: the six digits that prove the address belongs
 * to whoever typed it. Nothing else happens until they come back.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { verificationCodeSchema, type AuthOutcome } from '@wumboo/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useSendCode, useVerifyCode } from '../queries';

const codeFormSchema = z.object({ code: verificationCodeSchema });
type CodeValues = z.infer<typeof codeFormSchema>;

export interface PendingCode {
  /** The address the code went to; shown so a typo is obvious. */
  target: string;
  resendAfterSeconds: number;
  /** Development only: the code, when there is no mail service to send it. */
  devCode?: string | undefined;
}

export function CodeStep({
  pending,
  onPending,
  onSignedIn,
  onBack,
}: {
  pending: PendingCode;
  onPending: (next: PendingCode) => void;
  onSignedIn: () => void;
  onBack: () => void;
}) {
  const verify = useVerifyCode();
  const resend = useSendCode();
  const [serverError, setServerError] = useState<string | null>(null);
  const [wait, setWait] = useState(pending.resendAfterSeconds);

  const form = useForm<CodeValues>({
    resolver: standardSchemaResolver<CodeValues, unknown, CodeValues>(codeFormSchema),
    defaultValues: { code: pending.devCode ?? '' },
  });

  // The countdown is the whole explanation for why "Send another" is not a button yet.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  const settle = (outcome: AuthOutcome) => {
    if (outcome.status === 'signed-in') return onSignedIn();
    onPending({ ...pending, resendAfterSeconds: outcome.resendAfterSeconds });
    setWait(outcome.resendAfterSeconds);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      settle(await verify.mutateAsync({ email: pending.target, code: values.code }));
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'That did not work. Try again in a moment.',
      );
    }
  });

  const sendAnother = async () => {
    setServerError(null);
    try {
      const outcome = await resend.mutateAsync({ email: pending.target });
      if (outcome.status === 'verification-required') {
        setWait(outcome.resendAfterSeconds);
        if (outcome.devCode) form.setValue('code', outcome.devCode);
      }
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Could not send another code.');
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        We emailed a code to <strong className="text-foreground">{pending.target}</strong>. It is
        good for ten minutes.
      </p>

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
        hint={
          pending.devCode
            ? 'Filled in for you: this server has no mail service, so the code is not going anywhere.'
            : undefined
        }
        {...form.register('code')}
      />

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={verify.isPending}>
        {verify.isPending ? 'Checking\u2026' : 'Confirm'}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different address
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
