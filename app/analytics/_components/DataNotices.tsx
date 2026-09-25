import { Info } from "lucide-react";
import type { MetricsMeta } from "@/lib/analytics/engine/metrics";

/**
 * The engine's own caveats, shown as-is rather than hidden: warnings (e.g.
 * users fell back to summed daily figures, a theme hasn't synced yet)
 * prominently, standing notes (rates aren't journeys, All Themes users are
 * a sum) as small print.
 */
export function DataWarnings({ meta }: { meta: MetricsMeta }) {
  if (meta.warnings.length === 0 && !meta.mixedTimeZones) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-status-info-bg p-3 text-sm text-status-info-text dark:border-blue-900/50">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info-icon" aria-hidden />
      <ul className="flex flex-col gap-1">
        {meta.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
        {meta.mixedTimeZones && <li>These themes&apos; GA4 properties use different time zones, so &ldquo;today&rdquo; and other presets resolve to each property&apos;s own dates.</li>}
      </ul>
    </div>
  );
}

export function DataNotes({ meta }: { meta: MetricsMeta }) {
  return (
    <ul className="flex flex-col gap-1 text-xs text-zinc-500">
      {meta.notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
