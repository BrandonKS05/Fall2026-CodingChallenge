import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AuthDialog } from '@/features/auth/components/AuthDialog';
import {
  AuthDialogActionsContext,
  AuthDialogStateContext,
  type AuthDialogActions,
  type AuthDialogRequest,
} from '@/hooks/useAuthDialog';

/** Owns the one sign-in dialog for the whole app, so any page can summon it without leaving. */
export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AuthDialogRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);
  const actions = useMemo<AuthDialogActions>(() => ({ open: setRequest, close }), [close]);

  return (
    <AuthDialogActionsContext.Provider value={actions}>
      <AuthDialogStateContext.Provider value={request}>
        {children}
        <AuthDialog request={request} onClose={close} />
      </AuthDialogStateContext.Provider>
    </AuthDialogActionsContext.Provider>
  );
}
