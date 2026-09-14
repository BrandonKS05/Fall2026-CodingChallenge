/**
 * Login and registration share one form. Validation uses the same zod
 * schemas the backend enforces, so the client can never accept something
 * the server would reject.
 */
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { loginRequestSchema, registerRequestSchema, type LoginRequest, type RegisterRequest } from '@trove/shared';
import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { useLogin, useRegister } from '../queries';
import { FormField } from './FormField';

type Mode = 'login' | 'register';

const copy: Record<Mode, { title: string; description: string; submit: string; switchText: string; switchLabel: string; switchTo: string }> = {
  login: {
    title: 'Welcome back',
    description: 'Log in to get to your boards.',
    submit: 'Log in',
    switchText: 'New here?',
    switchLabel: 'Create an account',
    switchTo: '/register',
  },
  register: {
    title: 'Create your account',
    description: 'Save what you find and never lose it again.',
    submit: 'Sign up',
    switchText: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: '/login',
  },
};

type FormValues = RegisterRequest;

// Both modes share one field set so a single form type works; login simply ignores the name.
const loginFormSchema = loginRequestSchema.extend({ displayName: z.string() });
const resolvers = {
  login: standardSchemaResolver<FormValues, unknown, FormValues>(loginFormSchema),
  register: standardSchemaResolver<FormValues, unknown, FormValues>(registerRequestSchema),
};

export function AuthForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const register = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const text = copy[mode];
  const pending = login.isPending || register.isPending;

  const form = useForm<FormValues>({
    resolver: resolvers[mode],
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const destination = (location.state as { from?: string } | null)?.from ?? '/boards';

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (mode === 'login') {
        const body: LoginRequest = { email: values.email, password: values.password };
        await login.mutateAsync(body);
      } else {
        await register.mutateAsync(values);
      }
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  });

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <FormField
              id="displayName"
              label="Name"
              autoComplete="name"
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
            {...form.register('email')}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          {serverError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'One moment…' : text.submit}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {text.switchText}{' '}
            <Link to={text.switchTo} className="font-medium text-foreground underline-offset-4 hover:underline">
              {text.switchLabel}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
