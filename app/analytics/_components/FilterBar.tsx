"use client";

import { X } from "lucide-react";
import { FILTER_PARAMS, breakdownFor, type FilterParam } from "@/lib/analytics/engine/filters";
import type { DashboardFilters, DashboardParams } from "./useDashboardParams";

export const FILTER_LABELS: Record<FilterParam, string> = {
  country: "Country",
  device: "Device",
  landingPage: "Landing page",
  page: "Page",
};

const dimsOf = (filters: DashboardFilters) => (Object.keys(filters) as FilterParam[]).map((p) => FILTER_PARAMS[p]);

/**
 * Merges new filters into the current ones. Filters combine only within one
 * dimension family (see lib/analytics/engine/filters.ts), so if the new
 * ones can't coexist with the current set, they replace it instead of
 * producing a request the API would reject.
 */
export function mergeFilters(current: DashboardFilters, added: DashboardFilters): DashboardFilters {
  const combined = { ...current, ...added };
  try {
    breakdownFor(dimsOf(combined));
    return combined;
  } catch {
    return { ...added };
  }
}

/**
 * The active dimension filters as removable chips (they're added from any
 * breakdown table's "Filter" action).
 */
export function FilterBar({ params, onChange }: { params: DashboardParams; onChange: (patch: Partial<DashboardParams>) => void }) {
  const active = Object.entries(params.filters) as [FilterParam, string][];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-500">Filters:</span>
      {active.length === 0 && <span className="text-zinc-400">none — use &ldquo;Filter&rdquo; on any table row</span>}
      {active.map(([name, value]) => (
        <span key={name} className="inline-flex items-center gap-1 rounded-full bg-primary-tint py-0.5 pl-2.5 pr-1 text-primary-tint-text">
          <span className="font-medium">{FILTER_LABELS[name]}:</span>
          <span className="max-w-[16rem] truncate" title={value}>
            {value}
          </span>
          <button
            type="button"
            aria-label={`Remove ${FILTER_LABELS[name]} filter`}
            onClick={() => {
              const next = { ...params.filters };
              delete next[name];
              onChange({ filters: next });
            }}
            className="rounded-full p-0.5 hover:bg-primary/10"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      {active.length > 1 && (
        <button type="button" onClick={() => onChange({ filters: {} })} className="text-zinc-500 underline-offset-2 hover:underline">
          Clear all
        </button>
      )}
    </div>
  );
}
