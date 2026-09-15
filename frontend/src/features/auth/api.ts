import type {
  AuthProvidersResponse,
  AuthResponse,
  HandleAvailabilityResponse,
  LoginRequest,
  RegisterRequest,
  SessionResponse,
  UpdateProfileRequest,
  User,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** Typed calls only. No caching or React here; that is queries.ts's job. */
/** Adapter: the feature's slice of the API contract as typed calls, so components never see URLs. */
export const authApi = {
  me: () => http.get<SessionResponse>('/auth/me'),
  login: (body: LoginRequest) => http.post<AuthResponse>('/auth/login', body),
  register: (body: RegisterRequest) => http.post<AuthResponse>('/auth/register', body),
  logout: () => http.post<void>('/auth/logout'),
  providers: () => http.get<AuthProvidersResponse>('/auth/providers'),
  handleAvailability: (handle: string) =>
    http.get<HandleAvailabilityResponse>(
      `/auth/handle-available?handle=${encodeURIComponent(handle)}`,
    ),
  updateProfile: (body: UpdateProfileRequest) => http.patch<User>('/auth/me', body),
  deleteAccount: () => http.delete('/auth/me'),
};
