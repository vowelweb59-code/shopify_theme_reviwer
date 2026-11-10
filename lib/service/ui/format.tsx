// Small presentational helpers for the Service section (ported from the Upwork Project-Management web app's lib/hours.tsx
// and lib/status.tsx, restyled with this app's design tokens).
import type { ServiceProjectStatus } from "@/models/service-shared";

/** 150 -> "2h 30m". */
export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}

/** Hours with one decimal: 5025 minutes -> "83.8". For tables where "83h 45m" is too busy. */
export const fmtHours = (minutes: number) => (minutes / 60).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Cents as dollars: 1500 -> "$15.00". */
export const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** "+2h 10m vs last week" / "same as last week". */
export function fmtDelta(now: number, before: number): string {
  const d = now - before;
  return d === 0 ? "same as last week" : `${d > 0 ? "+" : "−"}${fmtMinutes(Math.abs(d))} vs last week`;
}

const DAY_MS = 86_400_000;
export type Week = { start: string; end: string };
export const shiftWeek = (start: string, weeks: number) => new Date(Date.parse(start) + weeks * 7 * DAY_MS).toISOString().slice(0, 10);
export const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const fmtLongDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const weekLabel = (w: Week) => `${fmtDay(w.start)} – ${fmtDay(w.end)}`;

/** Completed against the weekly limit. The numbers always sit beside it, so the bar is never the only signal. */
export function HoursBar({ hours }: { hours: { limitMinutes: number | null; completedMinutes: number; overLimitMinutes: number } }) {
  const pct = hours.limitMinutes ? Math.min(100, (hours.completedMinutes / hours.limitMinutes) * 100) : 0;
  const over = hours.overLimitMinutes > 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
      <div className={`h-full ${over ? "bg-status-fail-icon" : "bg-primary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Status is never conveyed by color alone: every badge carries an icon and a text label.
const META: Record<ServiceProjectStatus, { label: string; icon: string; tone: string }> = {
  NOT_STARTED: { label: "Not started", icon: "○", tone: "bg-status-not-tested-bg text-status-not-tested-text" },
  ACTIVE: { label: "Active", icon: "●", tone: "bg-status-pass-bg text-status-pass-text" },
  BLOCKED: { label: "Blocked", icon: "!", tone: "bg-status-fail-bg text-status-fail-text" },
  WAITING_FOR_CLIENT: { label: "Waiting for client", icon: "◔", tone: "bg-status-warning-bg text-status-warning-text" },
  ON_HOLD: { label: "On hold", icon: "❚❚", tone: "bg-status-warning-bg text-status-warning-text" },
  COMPLETED: { label: "Completed", icon: "✓", tone: "bg-status-info-bg text-status-info-text" },
  CANCELLED: { label: "Cancelled", icon: "✕", tone: "bg-status-not-tested-bg text-status-not-tested-text" },
  ARCHIVED: { label: "Archived", icon: "▣", tone: "bg-status-not-tested-bg text-status-not-tested-text" },
};

// Mirrors lib/service/projects/transitions.ts so the UI only offers legal moves; the API remains the authority.
export const NEXT_STATUSES: Record<ServiceProjectStatus, readonly ServiceProjectStatus[]> = {
  NOT_STARTED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["BLOCKED", "WAITING_FOR_CLIENT", "ON_HOLD", "COMPLETED", "CANCELLED"],
  BLOCKED: ["ACTIVE"],
  WAITING_FOR_CLIENT: ["ACTIVE"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: ["ARCHIVED", "ACTIVE"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const statusLabel = (s: ServiceProjectStatus) => META[s].label;
export const STATUS_OPTIONS = Object.entries(META).map(([value, m]) => ({ value: value as ServiceProjectStatus, label: m.label }));

export function ServiceStatusBadge({ status }: { status: ServiceProjectStatus }) {
  const m = META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tone}`}>
      <span aria-hidden="true">{m.icon}</span>
      {m.label}
    </span>
  );
}

/** Shared form-control look for the Service pages. */
export const INPUT = "rounded-md border border-border-subtle bg-transparent px-3 py-1.5 text-sm";
export const MUTED = "text-zinc-500";
