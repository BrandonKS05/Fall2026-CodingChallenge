/**
 * The sign-in card, floated over whatever page is open with the page blurred
 * behind it. It is a sheet of paper on the dark stage: cream grain, ink type,
 * and a brush-script greeting. Switching between log in and sign up happens
 * inside the card, so the visitor never leaves the page they were on.
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

const COPY: Record<AuthMode, { hello: string; title: string; description: string }> = {
  login: {
    hello: 'Hello dear,',
    title: 'Welcome back',
    description: 'Log in to get back to your boards.',
  },
  register: {
    hello: 'Hello there,',
    title: 'Start your gallery',
    description: 'Save what you find and never lose it again.',
  },
};

/** Fibrous paper: fractal noise tinted warm, low alpha, tiled over the cream. */
const PAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.25 0 0 0 0 0.2 0 0 0 0 0.12 0 0 0 0.45 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";

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
  const copy = COPY[mode];

  return (
    <DialogContent
      overlayClassName="bg-background/60 backdrop-blur-lg supports-backdrop-filter:backdrop-blur-lg"
      className="paper gap-5 bg-[#f1efe1] p-7 text-[#151515] ring-[#151515]/15 sm:max-w-md"
      style={{ backgroundImage: PAPER }}
    >
      <DialogHeader className="gap-1">
        <div className="flex items-baseline justify-between text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>{copy.hello}</span>
          <span>Wumboo</span>
        </div>
        <DialogTitle className="font-hand text-5xl leading-none font-normal tracking-tight sm:text-6xl">
          {copy.title}
        </DialogTitle>
        {/* A brush underline, drawn rather than a border, so it reads as handwriting. */}
        <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="h-3 w-3/4">
          <path
            d="M2 8 C 40 2, 80 12, 120 6 S 180 4, 198 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <DialogDescription className="pt-2 text-xs tracking-[0.12em] uppercase">
          {copy.description}
        </DialogDescription>
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
