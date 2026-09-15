import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  AuthDialogActionsContext,
  AuthDialogStateContext,
  type AuthDialogActions,
  type AuthDialogRequest,
} from '@/hooks/useAuthDialog';
import { AuthDialog } from '@/features/auth';

/**
 * Mediator: owns the one sign-in dialog for the whole app. Entry points (header,
 * hero, save dialog, board page) ask for it through `useAuthDialog` and never
 * know about each other or about the dialog itself.
 */
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
