"use client";

import { Check } from "lucide-react";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";

type EnhancementDetection = { pointId: string; detected: boolean };

export type FeatureMatrixRow = {
  theme: { _id: string; name: string; themeStoreFeatures?: string[] };
  latestAudit: { enhancementDetections?: EnhancementDetection[] } | null;
};

/**
 * The full AVAILABLE_FEATURES catalog (58 entries) as rows, one column per
 * theme, with a checkmark wherever that theme's latest audit detected the
 * feature — either directly (a mapped detector ran) or via its Theme Store
 * listing (see featureStatus's own precedence rules). Themes across the
 * top rather than down the side: there are usually far fewer themes than
 * features, so this reads as a tall-but-narrow table instead of a
 * 58-column-wide one.
 */
export function FeatureMatrixTable({ rows }: { rows: FeatureMatrixRow[] }) {
  const statusByTheme = rows.map((r) => {
    const detections = new Map((r.latestAudit?.enhancementDetections ?? []).map((d) => [d.pointId, d.detected]));
    const themeStoreLabels = r.theme.themeStoreFeatures ? new Set(r.theme.themeStoreFeatures.map((label) => label.toLowerCase())) : undefined;
    return AVAILABLE_FEATURES.map((f) => featureStatus(f, detections, themeStoreLabels));
  });

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border-subtle">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-primary-tint text-primary-tint-text">
          <tr>
            <th className="sticky left-0 z-20 min-w-[180px] bg-primary-tint px-3 py-2.5 font-semibold">Feature</th>
            {rows.map((r) => (
              <th key={r.theme._id} className="min-w-[90px] px-2 py-2.5 text-center font-semibold">
                {r.theme.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AVAILABLE_FEATURES.map((f, featureIndex) => (
            <tr key={f.id} className="border-t border-border-subtle">
              <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100" title={f.category}>
                {f.label}
              </td>
              {rows.map((r, themeIndex) => {
                const status = statusByTheme[themeIndex][featureIndex];
                return (
                  <td key={r.theme._id} className="px-2 py-2 text-center">
                    {status === "detected" && (
                      <span
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-status-pass-icon shadow-sm"
                        title="Available"
                      >
                        <Check className="h-4 w-4 stroke-[3] text-white" aria-label="Available" />
                      </span>
                    )}
                    {status === "conflict" && (
                      <span
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-status-warning-icon shadow-sm"
                        title="Listed on the Theme Store, but not detected in the theme's code — worth a second look"
                      >
                        <Check className="h-4 w-4 stroke-[3] text-white" aria-label="Conflicting signal" />
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
