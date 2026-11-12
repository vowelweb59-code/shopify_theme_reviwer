"use client";

import { Check } from "lucide-react";
import { AVAILABLE_FEATURES } from "@/lib/audit/availableFeatures";
import { featureCells, hasFeature, type FeatureCell } from "@/lib/themes/featureSuggestions";

type EnhancementDetection = { pointId: string; detected: boolean };

export type FeatureMatrixRow = {
  theme: { _id: string; name: string; themeStoreFeatures?: string[] };
  latestAudit: { enhancementDetections?: EnhancementDetection[]; liveFeatures?: string[] } | null;
};

// One soft tint per feature category, cycling; kept as /10 washes so both light and dark themes stay readable.
const GROUP_TINTS = [
  "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
];

// Columns are grouped by feature category (in the catalog's own order), each group under a tinted header band.
const GROUPS = (() => {
  const byCategory = new Map<string, typeof AVAILABLE_FEATURES>();
  for (const f of AVAILABLE_FEATURES) byCategory.set(f.category, [...(byCategory.get(f.category) ?? []), f]);
  return [...byCategory.entries()].map(([category, features], i) => ({ category, features, tint: GROUP_TINTS[i % GROUP_TINTS.length] }));
})();

const LABEL_ROW_HEIGHT = "h-52";

/**
 * The full AVAILABLE_FEATURES catalog as columns, one row per theme: a check wherever that theme's latest audit detected the
 * feature, directly (a mapped detector ran) or via its Theme Store listing (see featureStatus's precedence rules). Columns sit
 * under their category; the theme name (with how many features it covers) stays pinned on the left and the headers stay pinned
 * on top while scrolling. The last row counts how many themes have each feature.
 */
export function FeatureMatrixTable({ rows }: { rows: FeatureMatrixRow[] }) {
  const cells: Map<string, FeatureCell>[] = rows.map((r) =>
    featureCells({
      name: r.theme.name,
      themeStoreFeatures: r.theme.themeStoreFeatures,
      detections: r.latestAudit?.enhancementDetections,
      liveFeatures: r.latestAudit?.liveFeatures,
    })
  );
  const total = AVAILABLE_FEATURES.length;

  return (
    <div className="max-h-[75vh] overflow-auto rounded-xl border border-border-subtle bg-surface shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            <th rowSpan={2} className="sticky left-0 top-0 z-40 min-w-[150px] border-b border-r border-border-subtle bg-surface-muted px-4 py-3 align-bottom text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Theme
            </th>
            {GROUPS.map((g) => (
              <th
                key={g.category}
                colSpan={g.features.length}
                className={`sticky top-0 z-30 h-8 border-b border-l border-border-subtle px-2 text-center text-[11px] font-semibold uppercase tracking-wide ${g.tint}`}
              >
                <span className="sticky left-40 inline-block max-w-full truncate align-middle">{g.category}</span>
              </th>
            ))}
          </tr>
          <tr>
            {GROUPS.flatMap((g) =>
              g.features.map((f, i) => (
                <th
                  key={f.id}
                  title={`${f.label} (${f.category})`}
                  className={`sticky top-8 z-20 ${LABEL_ROW_HEIGHT} min-w-[38px] border-b border-border-subtle bg-surface-muted px-1 pb-3 align-bottom ${i === 0 ? "border-l" : ""}`}
                >
                  <span className="inline-block whitespace-nowrap text-[11px] font-medium text-zinc-600 [writing-mode:vertical-rl] rotate-180 dark:text-zinc-300">{f.label}</span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rowIndex) => {
            const covered = AVAILABLE_FEATURES.filter((f) => cells[rowIndex].get(f.id)?.status === "detected").length;
            const verifiedLive = AVAILABLE_FEATURES.filter((f) => cells[rowIndex].get(f.id)?.sources.live === true).length;
            const liveRead = r.latestAudit?.liveFeatures !== undefined;
            return (
              <tr key={r.theme._id} className="group even:bg-surface-muted/50">
                <td className="sticky left-0 z-10 border-b border-r border-border-subtle bg-surface px-4 py-2.5 group-even:bg-surface-muted group-hover:bg-primary-tint">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.theme.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-status-pass-icon" style={{ width: `${Math.round((covered / total) * 100)}%` }} />
                    </div>
                    <span className="tabular-nums text-[11px] text-zinc-500">
                      {covered}/{total}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500" title="Features whose markup was seen on the theme's live demo stores">
                    {liveRead ? `${verifiedLive} seen on live store` : "live store not read"}
                  </div>
                </td>
                {GROUPS.flatMap((g) =>
                  g.features.map((f, i) => {
                    const cell = cells[rowIndex].get(f.id);
                    const status = cell?.status;
                    const verified = cell?.sources.live === true;
                    const why = cell ? sourcesText(cell) : "";
                    return (
                      <td key={f.id} className={`border-b border-border-subtle px-1 py-2.5 text-center group-hover:bg-primary-tint/60 ${i === 0 ? "border-l" : ""}`}>
                        {status === "detected" && verified && (
                          <span
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-sm ring-1 ring-emerald-600/40"
                            title={`${r.theme.name}: ${f.label} is available and seen on the live store. ${why}`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3] text-white" aria-label="Available, seen on the live store" />
                          </span>
                        )}
                        {status === "detected" && !verified && (
                          <span
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30"
                            title={`${r.theme.name}: ${f.label} is available, not seen on the live store. ${why}`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3] text-emerald-600 dark:text-emerald-400" aria-label="Available, not seen on the live store" />
                          </span>
                        )}
                        {status === "conflict" && (
                          <span
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/40"
                            title={`${r.theme.name}: ${f.label} is listed on the Theme Store, but not detected in the theme's code. Worth a second look. ${why}`}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3] text-amber-600 dark:text-amber-400" aria-label="Conflicting signal" />
                          </span>
                        )}
                        {status !== "detected" && status !== "conflict" && (
                          <span className="mx-auto block h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" title={`${r.theme.name}: ${f.label} not found. ${why}`} aria-label="Not available" />
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            );
          })}
          <tr>
            <td className="sticky left-0 z-10 border-r border-border-subtle bg-surface-muted px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Themes with it</td>
            {GROUPS.flatMap((g) =>
              g.features.map((f, i) => {
                const n = cells.filter((c) => hasFeature(c.get(f.id))).length;
                return (
                  <td key={f.id} className={`bg-surface-muted px-1 py-2.5 text-center tabular-nums text-[11px] font-medium ${n === rows.length ? "text-zinc-500" : "text-zinc-900 dark:text-zinc-100"} ${i === 0 ? "border-l border-border-subtle" : ""}`}>
                    {n}
                  </td>
                );
              })
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const yesNo = (v: boolean | null, yes: string, no: string) => (v === null ? "n/a" : v ? yes : no);

/** The three sources behind one cell, for its tooltip. */
function sourcesText(cell: FeatureCell): string {
  const { code, live, store } = cell.sources;
  return `Code: ${yesNo(code, "found", "not found")}. Live store: ${yesNo(live, "seen", "not seen on the pages read")}. Theme Store listing: ${store ? "lists it" : "does not list it"}.`;
}
