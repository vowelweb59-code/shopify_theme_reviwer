"use client";

import { useState } from "react";
import type { CoverageResult } from "@/lib/audit/coverage";
import type { FindingRow } from "./findings";

const CATEGORY_ORDER = ["Theme Store Compliance", "Accessibility", "Technical SEO", "Technical AEO", "Bug", "Internal Standard"] as const;

// phase-5 §10 asks for finer sub-breakdowns per category (e.g. Accessibility's
// "Image issues" vs "Form/label issues" vs "ARIA issues"). Rules aren't
// tagged with a subcategory today, so guessing those from finding text would
// be unreliable — this shows the breakdown the data actually supports
// (severity + status + coverage) rather than fabricating finer buckets.
function categoryFindings(findings: FindingRow[], category: string): FindingRow[] {
  return findings.filter((f) => f.category === category);
}

function countBySeverity(findings: FindingRow[]) {
  return {
    blocker: findings.filter((f) => f.severity === "blocker").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };
}

function countByStatus(findings: FindingRow[]) {
  const open = findings.filter((f) => (f.status ?? "open") === "open").length;
  const resolved = findings.filter((f) => f.status === "resolved").length;
  const ignored = findings.filter((f) => f.status === "ignored").length;
  return { open, resolved, ignored };
}

export function CategoryDashboard({
  findings,
  coverageByCategory,
}: {
  findings: FindingRow[];
  coverageByCategory?: Record<string, CoverageResult>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORY_ORDER.map((category) => {
        const items = categoryFindings(findings, category);
        const severity = countBySeverity(items);
        const status = countByStatus(items);
        const coverage = coverageByCategory?.[category];
        const isOpen = expanded === category;

        return (
          <div key={category} className="rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.145]">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : category)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-medium text-zinc-950 dark:text-zinc-50">{category}</span>
              <span className="text-xs text-zinc-500">{items.length} finding{items.length === 1 ? "" : "s"}</span>
            </button>

            {isOpen && (
              <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex flex-wrap gap-3">
                  <span>Blocker: {severity.blocker}</span>
                  <span>High: {severity.high}</span>
                  <span>Medium: {severity.medium}</span>
                  <span>Low: {severity.low}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span>Open: {status.open}</span>
                  <span>Resolved: {status.resolved}</span>
                  <span>Ignored: {status.ignored}</span>
                </div>
                {coverage && (
                  <div className="flex flex-wrap gap-3">
                    <span>
                      Coverage: {coverage.percentage.toFixed(0)}% ({coverage.implemented}/{coverage.total})
                    </span>
                    <span>Not implemented: {coverage.notImplemented}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
