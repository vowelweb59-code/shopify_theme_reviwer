"use client";

import { Check } from "lucide-react";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";

type EnhancementDetection = { pointId: string; detected: boolean };

export type FeatureMatrixRow = {
  theme: { _id: string; name: string; themeStoreFeatures?: string[] };
  latestAudit: { enhancementDetections?: EnhancementDetection[] } | null;
};

/**
 * The full AVAILABLE_FEATURES catalog (58 entries) as columns, one row per theme, with a checkmark wherever that theme's latest
 * audit detected the feature, either directly (a mapped detector ran) or via its Theme Store listing (see featureStatus's own
 * precedence rules). Each theme reads as one line, so its whole feature set can be scanned left to right; the theme name stays
 * pinned on the left and the feature names (written vertically to keep the columns narrow) stay pinned on top while scrolling.
 */
export function FeatureMatrixTable({ rows }: { rows: FeatureMatrixRow[] }) {
  const statusByTheme = rows.map((r) => {
    const detections = new Map((r.latestAudit?.enhancementDetections ?? []).map((d) => [d.pointId, d.detected]));
    const themeStoreLabels = r.theme.themeStoreFeatures ? new Set(r.theme.themeStoreFeatures.map((label) => label.toLowerCase())) : undefined;
    return AVAILABLE_FEATURES.map((f) => featureStatus(f, detections, themeStoreLabels));
  });

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border-subtle">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[120px] border-b border-border-subtle bg-primary-tint px-3 py-2.5 align-bottom font-semibold text-primary-tint-text">
              Theme
            </th>
            {AVAILABLE_FEATURES.map((f) => (
              <th
                key={f.id}
                title={`${f.label} (${f.category})`}
                className="sticky top-0 z-20 h-40 min-w-[36px] border-b border-border-subtle bg-primary-tint px-1 pb-2 align-bottom font-medium text-primary-tint-text"
              >
                <span className="inline-block max-h-36 overflow-hidden whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{f.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, themeIndex) => (
            <tr key={r.theme._id} className="group">
              <td className="sticky left-0 z-10 border-b border-border-subtle bg-surface px-3 py-2 font-medium text-zinc-900 group-hover:bg-surface-muted dark:text-zinc-100">
                {r.theme.name}
              </td>
              {AVAILABLE_FEATURES.map((f, featureIndex) => {
                const status = statusByTheme[themeIndex][featureIndex];
                return (
                  <td key={f.id} className="border-b border-border-subtle px-1 py-2 text-center group-hover:bg-surface-muted">
                    {status === "detected" && (
                      <span
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-status-pass-icon shadow-sm"
                        title={`${r.theme.name}: ${f.label} is available`}
                      >
                        <Check className="h-4 w-4 stroke-[3] text-white" aria-label="Available" />
                      </span>
                    )}
                    {status === "conflict" && (
                      <span
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-status-warning-icon shadow-sm"
                        title={`${r.theme.name}: ${f.label} is listed on the Theme Store, but not detected in the theme's code. Worth a second look`}
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
