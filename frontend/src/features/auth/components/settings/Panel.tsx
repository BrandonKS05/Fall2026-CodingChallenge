import type { ReactNode } from 'react';

/** One settings section: a heading, a line saying what it covers, and its controls. */
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="settings-panel-title">
      <h2 id="settings-panel-title" className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-stage-ink/60">{description}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

/** A bordered group inside a panel. */
export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-stage-ink/15 bg-stage-ink/[0.03] p-5">{children}</div>
  );
}

/** A labelled row with its control on the right: the shape every toggle uses. */
export function Row({
  label,
  description,
  htmlFor,
  control,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-stage-ink/55">{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

/** Hairlines between rows, so a list of toggles reads as one group. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-stage-ink/10">{children}</div>;
}
