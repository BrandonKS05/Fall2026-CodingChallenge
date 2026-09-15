import { handleSchema } from '@wumboo/shared';
import type { LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '@wumboo/shared';
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

/** Asks whether a handle is free. Skipped until the handle could be valid at all. */
export function useHandleAvailability(handle: string) {
  const valid = handleSchema.safeParse(handle).success;
  return useQuery({
    queryKey: queryKeys.handleAvailability(handle),
    queryFn: () => authApi.handleAvailability(handle),
    enabled: valid,
    staleTime: 30_000,
    meta: { silentError: true },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => authApi.updateProfile(body),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
    meta: { silentError: true },
  });
}

/** Ends the account; the cache forgets everything the person could see. */
export function useDeleteAccount() {
  const setSession = useSessionSetter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      setSession(null);
      queryClient.removeQueries({ queryKey: queryKeys.collections.all });
      queryClient.removeQueries({ queryKey: queryKeys.notifications });
      queryClient.removeQueries({ queryKey: queryKeys.savedItems.all });
    },
  });
}

/** Which sign-in buttons to show. Configuration, so it never goes stale within a visit. */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'] as const,
    queryFn: () => authApi.providers(),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { silentError: true },
  });
}
