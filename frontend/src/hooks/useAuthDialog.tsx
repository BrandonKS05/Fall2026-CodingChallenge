/**
 * Summons the sign-in card over whatever page is open. The provider in app/
 * owns the one dialog; this hook is how any page or component asks for it.
 */
import { createContext, useCallback, useContext, useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';

export type AuthMode = 'login' | 'register';

export interface AuthDialogRequest {
  mode: AuthMode;
  /** Where to go after signing in. Omitted means stay on the current page. */
  from?: string;
  /** Runs when the person closes the card without signing in. */
  onDismiss?: () => void;
}

export interface AuthDialogActions {
  open(request: AuthDialogRequest): void;
  close(): void;
}

/** State and actions live in separate contexts so the actions stay referentially stable. */
export const AuthDialogStateContext = createContext<AuthDialogRequest | null>(null);
export const AuthDialogActionsContext = createContext<AuthDialogActions | null>(null);

const ROUTE_FOR: Record<AuthMode, string> = { login: '/login', register: '/register' };

/**
 * Outside the provider (an isolated test, say) the same requests fall back to
 * the /login and /register routes, which float the same card over Explore.
 */
export function useAuthDialog() {
  const request = useContext(AuthDialogStateContext);
  const actions = useContext(AuthDialogActionsContext);
  const navigate = useNavigate();

  // Stable identities, so an effect may depend on `open` and `close` without re-running each render.
  const open = useCallback(
    (next: AuthDialogRequest) => {
      if (actions) actions.open(next);
      else void navigate(ROUTE_FOR[next.mode], { state: next.from ? { from: next.from } : null });
    },
    [actions, navigate],
  );
  const close = useCallback(() => actions?.close(), [actions]);

  /**
   * Click handler for a real link to /login or /register: a plain click opens
   * the card in place, while modified clicks and middle clicks keep working as
   * links (new tab, and so on).
   */
  const intercept = useCallback(
    (next: AuthDialogRequest) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(next);
    },
    [open],
  );

  return useMemo(() => ({ request, open, close, intercept }), [request, open, close, intercept]);
}
