/**
 * Composition root for the client: query client, theme, tooltips, toasts.
 * Query errors surface as toasts unless a query or mutation opts out with
 * meta.silentError, which forms use to show errors inline instead.
 */
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
    queryMeta: { silentError?: boolean };
    mutationMeta: { silentError?: boolean };
  }
}

function describe(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/** Factory: one place decides retry, staleness, and how errors surface; tests build their own client here too. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status < 500),
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!query.meta?.silentError) toast.error(describe(error));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.silentError) toast.error(describe(error));
      },
    }),
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
