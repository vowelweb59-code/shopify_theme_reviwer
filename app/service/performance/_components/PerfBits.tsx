import type { ReactNode } from "react";

/** A thin horizontal meter; `over` turns it red. */
export function Meter({ value, max, tone = "bg-primary", over = false }: { value: number; max: number; tone?: string; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
      <div className={`h-full ${over ? "bg-status-fail-icon" : tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-zinc-500">{note}</div>}
    </div>
  );
}

/** Occupancy = allocated hours / weekly availability. */
export function occupancyState(occupancy: number): { label: string; tone: string } {
  if (occupancy > 1) return { label: "Over-allocated", tone: "bg-status-fail-bg text-status-fail-text" };
  if (occupancy >= 0.9) return { label: "Full", tone: "bg-status-warning-bg text-status-warning-text" };
  if (occupancy >= 0.5) return { label: "Balanced", tone: "bg-status-pass-bg text-status-pass-text" };
  return { label: "Available", tone: "bg-status-info-bg text-status-info-text" };
}

export const stars = (r: number | null) => (r === null ? "—" : `★ ${r.toFixed(1)}`);
