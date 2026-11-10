import type { ReactNode } from "react";

export const WARN = "text-status-warning-text";
export const BAD = "text-status-fail-text";
export const SECTION = "rounded-lg border border-border-subtle bg-surface p-4";
export const TH = "py-2 pr-3 font-medium";
export const THEAD = "text-xs uppercase tracking-wide text-zinc-500";
export const LINK = "font-medium text-primary hover:underline";

/** One headline figure of a tab overview. */
export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-muted p-3">
      <div className={`text-2xl font-semibold ${tone ?? "text-zinc-950 dark:text-zinc-50"}`}>{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
      {note && <div className="text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

export function Overview({ title = "Overview", children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={SECTION}>
      <h2 className="mb-3 font-medium text-zinc-950 dark:text-zinc-50">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}
