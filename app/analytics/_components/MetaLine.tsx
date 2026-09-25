import type { MetricsMeta } from "@/lib/analytics/engine/metrics";
import { FILTER_PARAMS, type FilterParam } from "@/lib/analytics/engine/filters";
import { FILTER_LABELS } from "./FilterBar";
import { formatDateTime, formatRange } from "./format";

/** One line saying exactly what the figures below cover: theme, dates, comparison, filters, freshness. */
export function MetaLine({ meta }: { meta: MetricsMeta }) {
  const filters = (Object.keys(FILTER_PARAMS) as FilterParam[])
    .map((p) => [p, meta.filters[FILTER_PARAMS[p]]] as const)
    .filter(([, v]) => v);
  const one = meta.scope === "theme" ? meta.themes[0] : null;
  return (
    <p className="text-xs text-zinc-500">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{meta.theme?.name ?? "All Themes"}</span>
      {" · "}
      {meta.range.label}: {formatRange(meta.range.current)}
      {meta.range.previous && <> · vs {formatRange(meta.range.previous)}</>}
      {filters.length > 0 && <> · {filters.map(([p, v]) => `${FILTER_LABELS[p]} = ${v}`).join(", ")}</>}
      {one && (
        <>
          {" · "}synced through {one.syncedThroughDate ?? "—"} (last sync {formatDateTime(one.lastSuccessfulSyncAt)})
        </>
      )}
    </p>
  );
}
