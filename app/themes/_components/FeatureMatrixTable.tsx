"use client";

import { Check } from "lucide-react";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";

type EnhancementDetection = { pointId: string; detected: boolean };

export type FeatureMatrixRow = {
  theme: { _id: string; name: string; themeStoreFeatures?: string[] };
  latestAudit: { enhancementDetections?: EnhancementDetection[] } | null;
};

/**
 * The full AVAILABLE_FEATURES catalog (58 entries) as columns against every
 * theme as a row, with a checkmark wherever that theme's latest audit
 * detected the feature — either directly (a mapped detector ran) or via
 * its Theme Store listing (see featureStatus's own precedence rules).
 * Deliberately flat (one column per feature, not grouped/collapsed) and
 * left un-paginated — this is meant to be scanned/scrolled as one matrix,
 * matching what was asked for rather than summarized.
 */
export function FeatureMatrixTable({ rows }: { rows: FeatureMatrixRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="text-left text-xs">
        <thead className="bg-surface-muted text-zinc-500">
          <tr>
            <th className="sticky left-0 z-10 min-w-[140px] bg-surface-muted px-3 py-2 font-medium">Theme</th>
            {AVAILABLE_FEATURES.map((f) => (
              <th key={f.id} className="min-w-[110px] max-w-[110px] whitespace-normal px-2 py-2 text-left font-medium" title={f.label}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const detections = new Map((r.latestAudit?.enhancementDetections ?? []).map((d) => [d.pointId, d.detected]));
            const themeStoreLabels = r.theme.themeStoreFeatures
              ? new Set(r.theme.themeStoreFeatures.map((label) => label.toLowerCase()))
              : undefined;
            return (
              <tr key={r.theme._id} className="border-t border-border-subtle">
                <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{r.theme.name}</td>
                {AVAILABLE_FEATURES.map((f) => {
                  const status = featureStatus(f, detections, themeStoreLabels);
                  return (
                    <td key={f.id} className="px-2 py-2 text-center">
                      {status === "detected" && <Check className="mx-auto h-3.5 w-3.5 text-status-pass-icon" aria-label="Available" />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
