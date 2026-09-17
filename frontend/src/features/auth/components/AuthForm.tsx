/**
 * Login and registration share one form. Validation uses the same zod
 * schemas the backend enforces, so the client can never accept something
 * the server would reject. The surface around it (card, dialog) is the
 * caller's; this is only the fields, the submit, and the mode switch.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  handleFromSeed,
  loginRequestSchema,
  registerRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@wumboo/shared';
import { CheckIcon } from 'lucide-react';
import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import type { AuthMode } from '@/hooks/useAuthDialog';
import { ApiError } from '@/lib/api';
import { useAuthProviders, useHandleAvailability, useLogin, useRegister } from '../queries';
import { FormField } from '@/components/common/FormField';
import { PasswordField } from '@/components/common/PasswordField';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import { PASSWORD_RULES } from '../passwordRules';
import { CodeStep, type PendingCode } from './CodeStep';
import { GoogleButton } from './GoogleButton';

/** Reasons the Google callback can send the browser back with. */
const OAUTH_ERRORS: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  oauth_state: 'That sign-in attempt expired. Please try again.',
  google_failed: 'Google sign-in did not work. Try again, or use your password.',
  google_unavailable: 'Google sign-in is not set up on this server.',
};

const copy: Record<
  AuthMode,
  { submit: string; switchText: string; switchLabel: string; switchTo: AuthMode }
> = {
  login: {
    submit: 'Log in',
    switchText: 'New here?',
    switchLabel: 'Create an account',
    switchTo: 'register',
  },
  register: {
    submit: 'Sign up',
    switchText: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: 'login',
  },
};

const ROUTE_FOR: Record<AuthMode, string> = { login: '/login', register: '/register' };

type FormValues = RegisterRequest & { confirmPassword: string };

/** Typing the password twice is the client's business, so the second copy never leaves the form. */
const registerFormSchema = registerRequestSchema
  .extend({ confirmPassword: z.string().min(1, 'Type your password once more') })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Those two do not match',
  });

// Both modes share one field set so a single form type works; login ignores all but two.
const loginFormSchema = loginRequestSchema.extend({
  displayName: z.string(),
  handle: z.string(),
  confirmPassword: z.string(),
});
const resolvers = {
  login: standardSchemaResolver<FormValues, unknown, FormValues>(loginFormSchema),
  register: standardSchemaResolver<FormValues, unknown, FormValues>(registerFormSchema),
};

export interface AuthFormProps {
  mode: AuthMode;
  /** Switch modes in place (inside the dialog). Without it the switch is a link to the other route. */
  onSwitchMode?: (mode: AuthMode) => void;
  /** Runs after a successful sign-in. Without it the form navigates to `state.from` or the boards. */
  onSuccess?: () => void;
}

export function AuthForm({ mode, onSwitchMode, onSuccess }: AuthFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const register = useRegister();
  const [params] = useSearchParams();
  const providers = useAuthProviders();
  const oauthError = OAUTH_ERRORS[params.get('error') ?? ''] ?? null;
  const [serverError, setServerError] = useState<string | null>(oauthError);
  // Once a code is out, it is the only thing on screen: the form has done its part.
  const [awaitingCode, setAwaitingCode] = useState<PendingCode | null>(null);
  const text = copy[mode];
  const pending = login.isPending || register.isPending;

  const form = useForm<FormValues>({
    resolver: resolvers[mode],
    defaultValues: { email: '', handle: '', password: '', confirmPassword: '', displayName: '' },
  });

  const signingUp = mode === 'register';
  const password = form.watch('password');
  const handle = form.watch('handle');
  // One lookup per pause in typing, and only once the handle could be valid at all.
  const debouncedHandle = useDebouncedValue(handle, 400);
  const availability = useHandleAvailability(signingUp ? debouncedHandle : '');
  const taken = availability.data?.available === false ? availability.data.handle : null;
  const free = availability.data?.available === true ? availability.data.handle : null;

  // A handle nobody has touched follows the email, which is what most people would pick anyway.
  const emailField = form.register('email', {
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      const typed = event.target.value;
      if (signingUp && typed && !form.getFieldState('handle').isDirty) {
        form.setValue('handle', handleFromSeed(typed));
      }
    },
  });

  const destination = (location.state as { from?: string } | null)?.from ?? '/boards';

  const finish = async () => {
    if (onSuccess) onSuccess();
    else await navigate(destination, { replace: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const body: LoginRequest = { email: values.email, password: values.password };
      const outcome =
        mode === 'login'
          ? await login.mutateAsync(body)
          : await register.mutateAsync({
              email: values.email,
              handle: values.handle,
              displayName: values.displayName,
              password: values.password,
            });
      // Signing up is not being signed in: the code is what finishes it.
      if (outcome.status === 'verification-required') {
        setAwaitingCode({
          target: outcome.target,
          resendAfterSeconds: outcome.resendAfterSeconds,
          devCode: outcome.devCode,
        });
        return;
      }
      await finish();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    }
  });

  const switchClassName = 'font-medium text-foreground underline-offset-4 hover:underline';

  if (awaitingCode) {
    return (
      <CodeStep
        pending={awaitingCode}
        onPending={setAwaitingCode}
        onSignedIn={() => void finish()}
        onBack={() => setAwaitingCode(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {providers.data?.google && (
        <>
          <GoogleButton />
          <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {signingUp && (
          <FormField
            id="displayName"
            label="Name"
            autoComplete="name"
            hint="What people see. Change it whenever you like."
            error={form.formState.errors.displayName?.message}
            {...form.register('displayName')}
          />
        )}
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...emailField}
        />
        {signingUp && (
          <FormField
            id="handle"
            label="Handle"
            prefix="@"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="yourname"
            error={
              form.formState.errors.handle?.message ??
              (taken === handle && handle ? `@${handle} is taken` : undefined)
            }
            hint={
              free === handle && handle ? (
                <span className="text-emerald-600 dark:text-emerald-400">@{handle} is free</span>
              ) : (
                'How people find you. It can only change every two weeks.'
              )
            }
            {...form.register('handle')}
          />
        )}
        <PasswordField
          id="password"
          label="Password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          error={form.formState.errors.password?.message}
          hint={signingUp ? <PasswordRules password={password} /> : undefined}
          {...form.register('password')}
        />
        {signingUp && (
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'One moment…' : text.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {text.switchText}{' '}
          {onSwitchMode ? (
            <button
              type="button"
              className={switchClassName}
              onClick={() => onSwitchMode(text.switchTo)}
            >
              {text.switchLabel}
            </button>
          ) : (
            <Link to={ROUTE_FOR[text.switchTo]} className={switchClassName}>
              {text.switchLabel}
            </Link>
          )}
        </p>
      </form>
    </div>
  );
}

/** The rules, ticking off as they are met. Quiet until there is something to say. */
function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.holds(password);
        return (
          <li key={rule.label} className="flex items-center gap-1.5">
            <CheckIcon
              aria-hidden
              className={cn(
                'size-3',
                met ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-30',
              )}
            />
            <span className={cn(met && 'text-foreground')}>{rule.label}</span>
            <span className="sr-only">{met ? ' met' : ' not met yet'}</span>
          </li>
        );
      })}
    </ul>
  );
}
