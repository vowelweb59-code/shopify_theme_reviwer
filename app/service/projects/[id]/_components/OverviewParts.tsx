import type { ReactNode } from "react";

// Building blocks of the project overview, in the style of Shopify's admin: roomy rounded cards with a quiet title row, one big number per
// metric card, secondary text kept small and grey, and a thin meter where a figure has a limit.

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border-subtle bg-surface shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  sub,
  meter,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  meter?: { value: number; max: number; over?: boolean };
  tone?: "default" | "bad";
}) {
  const pct = meter && meter.max > 0 ? Math.min(100, (meter.value / meter.max) * 100) : 0;
  const bar = meter?.over ? "bg-status-fail-icon" : pct >= 80 ? "bg-status-warning-icon" : "bg-status-pass-icon";
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${tone === "bad" ? "text-status-fail-text" : ""}`}>{value}</div>
      {meter && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {sub && <div className="mt-2 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

/** Hours per day of the chosen week or month as thin bars (tooltips carry the figures). */
export function DayBars({ days, month }: { days: Array<{ date: string; minutes: number }>; month: boolean }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const label = (d: { date: string }, i: number) => {
    const dt = new Date(`${d.date}T00:00:00Z`);
    if (!month) return dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return i % 5 === 0 ? String(dt.getUTCDate()) : "";
  };
  return (
    <div role="img" aria-label="Hours per day">
      <div className="flex h-24 items-end gap-1">
        {days.map((d) => (
          <div
            key={d.date}
            className="flex h-full min-w-0 flex-1 items-end"
            title={`${new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}: ${hm(d.minutes)}`}
          >
            <div
              className={`w-full rounded-t-[4px] ${d.minutes > 0 ? "bg-primary" : "bg-surface-muted"}`}
              style={{ height: `${d.minutes > 0 ? Math.max(4, (d.minutes / max) * 100) : 3}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[11px] text-zinc-500">
        {days.map((d, i) => (
          <div key={d.date} className="min-w-0 flex-1 text-center">
            {label(d, i)}
          </div>
        ))}
      </div>
    </div>
  );
}

const hm = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
};

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary-tint-text"
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** A label/value line in a details card. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2 text-sm last:border-b-0">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/** A role with the people in it, each with an initial badge. */
export function PeopleLine({ role, names, empty }: { role: string; names: string[]; empty: string }) {
  return (
    <div className="py-2">
      <div className="text-xs font-medium text-zinc-500">{role}</div>
      {names.length === 0 ? (
        <div className="mt-1 text-sm text-zinc-400">{empty}</div>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-2 text-sm">
              <Avatar name={n} />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
