import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userFixture } from '@/testing/fixtures';
import { renderWithProviders, stubApi, type StubRoute } from '@/testing/render';
import { AuthForm } from './AuthForm';

function renderForm(routes: Record<string, StubRoute> = {}) {
  const api = stubApi({
    'GET /api/auth/providers': { body: { google: false } },
    'GET /api/auth/handle-available': ({ url }) => ({
      body: {
        handle: new URL(url, 'http://x').searchParams.get('handle'),
        available: !url.includes('handle=taken'),
      },
    }),
    'POST /api/auth/register': {
      status: 202,
      body: {
        status: 'verification-required',
        target: 'ada@example.com',
        resendAfterSeconds: 30,
      },
    },
    'POST /api/auth/verify': { body: { status: 'signed-in', user: userFixture } },
    'POST /api/auth/code': {
      status: 202,
      body: {
        status: 'verification-required',
        target: 'ada@example.com',
        resendAfterSeconds: 30,
      },
    },
    ...routes,
  });
  vi.stubGlobal('fetch', api.fetchMock);
  renderWithProviders(<AuthForm mode="register" />);
  return api;
}

describe('AuthForm, signing up', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for a handle, suggests one from the email, and says when it is taken', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Email'), 'Ada.Lovelace@example.com');
    await userEvent.tab();
    expect(screen.getByLabelText('Handle')).toHaveValue('adalovelace');

    const handle = screen.getByLabelText('Handle');
    await userEvent.clear(handle);
    await userEvent.type(handle, 'taken');
    expect(await screen.findByText('@taken is taken')).toBeInTheDocument();

    await userEvent.clear(handle);
    await userEvent.type(handle, 'ada');
    expect(await screen.findByText('@ada is free')).toBeInTheDocument();
  });

  it('will not submit a weak password, or two that differ', async () => {
    const api = renderForm();

    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Use at least 10 characters')).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'POST')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'lovelace-1815');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByText('Those two do not match')).toBeInTheDocument();
    expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('reveals the password on request, and sends the handle with the rest', async () => {
    const api = renderForm();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    // The email has already suggested a handle by now; this replaces it.
    await userEvent.clear(screen.getByLabelText('Handle'));
    await userEvent.type(screen.getByLabelText('Handle'), 'ada');
    await userEvent.type(password, 'lovelace-1815');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'lovelace-1815');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.method === 'POST')).toMatchObject({
        path: '/api/auth/register',
        body: {
          email: 'ada@example.com',
          handle: 'ada',
          displayName: 'Ada',
          password: 'lovelace-1815',
        },
      }),
    );
    // The second copy is the form's business and never leaves it.
    const posted = api.calls.find((call) => call.method === 'POST')?.body as object;
    expect(posted).not.toHaveProperty('confirmPassword');
  });
});

describe('AuthForm, proving who you are', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'lovelace-1815');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'lovelace-1815');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
  }

  it('asks for the emailed code before it lets anyone in', async () => {
    const api = renderForm();
    await fillAndSubmit();

    // Signing up is not being signed in: the form gives way to the code.
    expect(await screen.findByText(/We emailed a code to/)).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(api.calls.find((call) => call.path === '/api/auth/verify')?.body).toMatchObject({
        email: 'ada@example.com',
        code: '123456',
      }),
    );
  });

  it('counts down before another code can be asked for', async () => {
    renderForm();
    await fillAndSubmit();

    const resend = await screen.findByRole('button', { name: /Send another in \d+s/ });
    expect(resend).toBeDisabled();
  });
});
