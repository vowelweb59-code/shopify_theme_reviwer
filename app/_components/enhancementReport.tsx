"use client";

import { useState } from "react";
import Link from "next/link";
import { TIER_LABELS } from "@/lib/enhancements/tiers";

type EnhancementMatch = { filePath: string; lineNumber: number | null };

export type EnhancementReportPoint = {
  pointId: string;
  name: string;
  category: string;
  description: string;
  auditHint: string | null;
  source: "theme-store-trend" | "native-capability";
  adoptionTier: string | null;
  themeCount: number | null;
  themeTotal: number | null;
  adoptionPercentage: number | null;
  appCategoryReplaced: string | null;
  nativeCapabilityCompleteness: "full" | "partial" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /** true/false once detection has run for this audit; null when it hasn't (see `detectionAvailable`). */
  detected: boolean | null;
  matches: EnhancementMatch[];
};

const sortByAdoption = (a: EnhancementReportPoint, b: EnhancementReportPoint) =>
  (b.themeCount ?? -1) - (a.themeCount ?? -1) || a.name.localeCompare(b.name);

const TIER_STYLES: Record<string, string> = {
  established: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  common: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  emerging: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  experimental: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

function PointRow({
  point,
  showDetection,
  expanded,
  onToggle,
}: {
  point: EnhancementReportPoint;
  showDetection: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isNative = point.source === "native-capability";

  return (
    <li className="rounded-lg border border-black/[.08] dark:border-white/[.145]">
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-950 dark:text-zinc-50">{point.name}</span>
            {isNative && point.appCategoryReplaced && (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-400">
                Replaces: {point.appCategoryReplaced}
              </span>
            )}
            {point.adoptionTier && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${TIER_STYLES[point.adoptionTier] ?? ""}`}>
                {point.adoptionPercentage}% · {point.themeCount}/{point.themeTotal} themes
              </span>
            )}
            {showDetection && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  point.detected
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {point.detected ? "Detected" : "Not detected"}
              </span>
            )}
          </span>
          <span className="font-mono text-xs text-zinc-500">
            {point.pointId} · {point.category}
            {point.adoptionTier && ` · ${TIER_LABELS[point.adoptionTier as keyof typeof TIER_LABELS] ?? point.adoptionTier}`}
          </span>
        </span>
        <span aria-hidden className="pt-1 text-zinc-400">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-black/[.08] p-4 text-sm dark:border-white/[.145]">
          <p className="text-zinc-700 dark:text-zinc-300">{point.description}</p>
          {point.auditHint && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What to check</h4>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">{point.auditHint}</p>
            </div>
          )}
          {isNative && point.sourceUrl && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Official documentation</h4>
              <a
                href={point.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                {point.sourceName ?? point.sourceUrl}
              </a>
            </div>
          )}
          {showDetection && point.detected && point.matches.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Detected in</h4>
              <ul className="mt-1 flex flex-col gap-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {point.matches.map((m, i) => (
                  <li key={`${m.filePath}-${i}`}>
                    {m.filePath}
                    {m.lineNumber ? `:${m.lineNumber}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function EnhancementReportSection({
  points,
  detectionAvailable,
}: {
  points: EnhancementReportPoint[];
  detectionAvailable: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const detected = points.filter((p) => p.detected === true).sort(sortByAdoption);
  const notDetected = points.filter((p) => p.detected === false).sort(sortByAdoption);
  // Points can be null even when detectionAvailable is true: the point set
  // grows over time (scripts/seed-enhancement-points.ts is additive), so an
  // older run's stored enhancementDetections simply has no entry for a
  // point added after it ran. Without this bucket those points would just
  // vanish from both lists above — silently, with no indication anything
  // was skipped.
  const notChecked = points.filter((p) => p.detected === null).sort(sortByAdoption);
  const allSortedByAdoption = points.slice().sort(sortByAdoption);

  return (
    <div className="flex flex-col gap-6 border-t border-black/[.08] pt-8 dark:border-white/[.145]">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Future updates</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Theme Store adoption trends and documented native-Shopify capabilities this theme could add (see{" "}
          <Link href="/enhancements" className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
            Future updates
          </Link>{" "}
          for the full backlog, including sources). <strong>Not</strong> approval requirements — nothing here affects
          readiness or coverage.
        </p>
      </div>

      {!detectionAvailable && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-300">
          This audit ran before per-theme detection was added, so which of these this theme already has isn&apos;t
          known.{" "}
          <strong>Re-run the audit</strong> to check the theme&apos;s source against every point below. Detection is
          heuristic (pattern matching, not exhaustive) — treat results as a starting point.
        </div>
      )}

      {detectionAvailable && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <strong className="text-zinc-950 dark:text-zinc-50">{detected.length}</strong> of{" "}
            <strong className="text-zinc-950 dark:text-zinc-50">{detected.length + notDetected.length}</strong> checked
            points detected in this theme&apos;s source. Detection is heuristic pattern matching — a miss doesn&apos;t
            prove the theme lacks the capability, and a hit doesn&apos;t prove it works correctly.
            {notChecked.length > 0 &&
              ` ${notChecked.length} point${notChecked.length === 1 ? "" : "s"} ${
                notChecked.length === 1 ? "was" : "were"
              } added since this audit ran and ${notChecked.length === 1 ? "hasn't" : "haven't"} been checked yet — re-run the audit to include ${notChecked.length === 1 ? "it" : "them"}.`}
          </p>

          {notChecked.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Not yet checked <span className="font-normal text-zinc-500">({notChecked.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {notChecked.map((p) => (
                  <PointRow
                    key={p.pointId}
                    point={p}
                    showDetection={false}
                    expanded={expanded === p.pointId}
                    onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
                  />
                ))}
              </ul>
            </section>
          )}

          {notDetected.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Not detected <span className="font-normal text-zinc-500">({notDetected.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {notDetected.map((p) => (
                  <PointRow
                    key={p.pointId}
                    point={p}
                    showDetection
                    expanded={expanded === p.pointId}
                    onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
                  />
                ))}
              </ul>
            </section>
          )}

          {detected.length > 0 && (
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Already present <span className="font-normal text-zinc-500">({detected.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {detected.map((p) => (
                  <PointRow
                    key={p.pointId}
                    point={p}
                    showDetection
                    expanded={expanded === p.pointId}
                    onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!detectionAvailable && (
        <ul className="flex flex-col gap-2">
          {allSortedByAdoption.map((p) => (
            <PointRow
              key={p.pointId}
              point={p}
              showDetection={false}
              expanded={expanded === p.pointId}
              onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
