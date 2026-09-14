import type { LoginRequest, RegisterRequest, User } from '@trove/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { authApi } from './api';

/** The signed-in user, or null when signed out. The endpoint answers 200 either way. */
export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: async (): Promise<User | null> => (await authApi.me()).user,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { silentError: true },
  });
  return { user: query.data ?? null, isLoading: query.isPending, error: query.error };
}

function useSessionSetter() {
  const queryClient = useQueryClient();
  return (user: User | null) => {
    queryClient.setQueryData(queryKeys.session, user);
    // Anything scoped to a user (boards, notifications) is stale once the session changes.
    void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  };
}

export function useLogin() {
  const setSession = useSessionSetter();
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (response) => setSession(response.user),
    meta: { silentError: true },
  });
}

export function useRegister() {
  const setSession = useSessionSetter();
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (response) => setSession(response.user),
    meta: { silentError: true },
  });
}

export function useLogout() {
  const setSession = useSessionSetter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      setSession(null);
      queryClient.removeQueries({ queryKey: queryKeys.collections.all });
      queryClient.removeQueries({ queryKey: queryKeys.notifications });
    },
  });
}
