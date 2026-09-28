import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Change, KpiComparison, KpiSet } from "@/lib/analytics/engine/kpis";
import { formatCount, formatPercent } from "./format";

/**
 * Change vs the previous period: an arrow + text, never colour alone. Kept
 * neutral (not green/red) because the app reserves its status colours for
 * pass/fail states, and "down" isn't always bad news.
 */
export function ChangeBadge({ change, unit = "percent" }: { change: Change | null | undefined; unit?: "percent" | "points" }) {
  if (!change || change.change === null) return null;
  const value = unit === "points" ? change.change : change.changePercent;
  if (value === null) return <span className="text-xs text-zinc-400">new vs previous</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const text = unit === "points" ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pts` : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text}
      <span className="sr-only"> compared with the previous period</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  change,
  changeUnit,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string;
  change?: Change | null;
  changeUnit?: "percent" | "points";
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border p-4 ${emphasis ? "border-primary/30 bg-primary-tint/40" : "border-border-subtle bg-surface"}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</span>
      <div className="flex min-h-4 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        {detail && <span className="text-xs text-zinc-500">{detail}</span>}
        <ChangeBadge change={change} unit={changeUnit} />
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return <div className="h-[108px] animate-pulse rounded-lg border border-border-subtle bg-surface-muted" aria-hidden />;
}

/** The three headline cards: Try Theme clicks, installs, and installs per Try Theme click. */
export function KpiCards({ current, comparison, installsEstimated = false }: { current: KpiSet; comparison: KpiComparison | null; installsEstimated?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard label="Try Theme" value={formatCount(current.tryTheme)} detail="clicks" change={comparison?.tryTheme} emphasis />
      <KpiCard
        label="Theme Installs"
        value={`${installsEstimated ? "≈" : ""}${formatCount(current.installs)}`}
        detail={installsEstimated ? "includes estimates" : "installs"}
        change={comparison?.installs}
        emphasis
      />
      <KpiCard label="Install Rate" value={formatPercent(current.installRate, 2)} detail="installs ÷ Try Theme clicks" change={comparison?.installRate} changeUnit="points" emphasis />
    </div>
  );
}
