"use client";

import { useState } from "react";
import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/analytics/engine/dateRanges";
import type { DashboardParams } from "./useDashboardParams";

export type ThemeOption = { slug: string; name: string; mapped: boolean };

const selectClass =
  "rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-zinc-800 hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-zinc-200";

/**
 * The global controls, in one row above everything they affect: theme,
 * date range (with pickers for a custom range) and previous-period
 * comparison. Themes come from the database, so a newly mapped theme
 * shows up here without a code change.
 */
export function DashboardControls({
  params,
  onChange,
  themes,
}: {
  params: DashboardParams;
  onChange: (patch: Partial<DashboardParams>) => void;
  themes: ThemeOption[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Theme
        <select className={selectClass} value={params.theme} onChange={(e) => onChange({ theme: e.target.value })}>
          <option value="all">All Themes</option>
          {themes.map((t) => (
            <option key={t.slug} value={t.slug} disabled={!t.mapped}>
              {t.name}
              {t.mapped ? "" : " (not connected)"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Date range
        <select
          className={selectClass}
          value={params.range}
          onChange={(e) => onChange({ range: e.target.value as DateRangePreset, ...(e.target.value === "custom" ? {} : { start: null, end: null }) })}
        >
          {DATE_RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {DATE_RANGE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      {params.range === "custom" && (
        // Keyed on the applied dates, so back/forward navigation resets the pickers.
        <CustomRange key={`${params.start}|${params.end}`} initialStart={params.start ?? ""} initialEnd={params.end ?? ""} onApply={(start, end) => onChange({ start, end })} />
      )}

      <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={params.compare} onChange={(e) => onChange({ compare: e.target.checked })} />
        Compare with previous period
      </label>
    </div>
  );
}

/** Custom dates are held locally until Apply, so picking the first date doesn't fire a request for a half-finished range. */
function CustomRange({ initialStart, initialEnd, onApply }: { initialStart: string; initialEnd: string; onApply: (start: string, end: string) => void }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const invalid = Boolean(start && end && start > end);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (start && end && !invalid) onApply(start, end);
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        From
        <input type="date" className={selectClass} value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        To
        <input type="date" className={selectClass} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <button
        type="submit"
        disabled={!start || !end || invalid}
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply
      </button>
      {invalid && <span className="pb-2 text-xs text-status-fail-text">The start date must be before the end date.</span>}
    </form>
  );
}
