import type {
  AuthProvidersResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  SessionResponse,
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
};
