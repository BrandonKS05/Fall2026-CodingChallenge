/** Renders a component inside the same providers the app uses, with a memory router. */
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthDialogProvider } from '@/app/AuthDialogProvider';
import { createQueryClient } from '@/app/providers';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>
              <AuthDialogProvider>{children}</AuthDialogProvider>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export interface StubCall {
  method: string;
  path: string;
  /** Full URL including the query string. */
  url: string;
  body: unknown;
}

export interface StubResponse {
  status?: number;
  body?: unknown;
}

/** A static answer, or a function so the stub can reflect earlier calls (e.g. a list after a delete). */
export type StubRoute = StubResponse | ((call: StubCall) => StubResponse);

/** A fetch stub that answers by "METHOD /path" (query string ignored), recording every call. */
export function stubApi(routes: Record<string, StubRoute>) {
  const calls: StubCall[] = [];
  const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    const method = init?.method ?? 'GET';
    const call: StubCall = {
      method,
      path,
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);

    const route = routes[`${method} ${path}`];
    if (!route) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: `no stub for ${method} ${path}` } }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }
    const response = typeof route === 'function' ? route(call) : route;
    const status = response.status ?? 200;
    return response.body === undefined
      ? new Response(null, { status: status === 200 ? 204 : status })
      : new Response(JSON.stringify(response.body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
  };
  return { fetchMock, calls };
}
