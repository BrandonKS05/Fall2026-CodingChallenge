/**
 * The sign-in card, floated over whatever page is open with the page blurred
 * behind it. Switching between log in and sign up happens inside the card, so
 * the visitor never leaves the page they were on.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AuthDialogRequest, AuthMode } from '@/hooks/useAuthDialog';
import { AuthForm } from './AuthForm';

const HEADINGS: Record<AuthMode, { title: string; description: string }> = {
  login: { title: 'Welcome back', description: 'Log in to get to your boards.' },
  register: {
    title: 'Create your account',
    description: 'Save what you find and never lose it again.',
  },
};

interface AuthDialogProps {
  request: AuthDialogRequest | null;
  onClose: () => void;
}

export function AuthDialog({ request, onClose }: AuthDialogProps) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        // Only user dismissals arrive here (Escape, backdrop, the X); success closes directly.
        if (open) return;
        onClose();
        request?.onDismiss?.();
      }}
    >
      {request && <AuthDialogBody request={request} onClose={onClose} />}
    </Dialog>
  );
}

/** Mounted only while open, so the mode resets to the request's each time. */
function AuthDialogBody({ request, onClose }: { request: AuthDialogRequest; onClose: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(request.mode);
  const heading = HEADINGS[mode];

  return (
    <DialogContent
      overlayClassName="bg-background/60 backdrop-blur-lg supports-backdrop-filter:backdrop-blur-lg"
      className="gap-6 p-6 sm:max-w-sm"
    >
      <DialogHeader>
        <DialogTitle className="text-lg">{heading.title}</DialogTitle>
        <DialogDescription>{heading.description}</DialogDescription>
      </DialogHeader>
      <AuthForm
        mode={mode}
        onSwitchMode={setMode}
        onSuccess={() => {
          onClose();
          if (request.from) void navigate(request.from, { replace: true });
        }}
      />
    </DialogContent>
  );
}
