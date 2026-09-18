"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MinusCircle, XCircle } from "lucide-react";
import { getPageLabel } from "@/lib/audit/pageLabel";
import type { PageSpeedMetric } from "@/lib/audit/pageSpeed";

export type FindingSummary = {
  total: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
  byCategory?: Record<string, number>;
};

export type AuditDiagnostics = {
  parserWarnings: number;
  unresolvedDynamicReferences: number;
  filesSkipped: number;
  rulesSkippedDueToError: number;
};

export type CoverageSummary = {
  total: number;
  implemented: number;
  partial: number;
  notImplemented: number;
  percentage: number;
};

export type ReadinessStatus = "READY" | "NOT_READY" | "INCOMPLETE";
export type ReadinessSummary = { status: ReadinessStatus; reasons: string[] };

export type FindingStatus = "open" | "resolved" | "ignored";

export type FindingRow = {
  _id?: string;
  ruleId: string;
  requirementId?: string | null;
  filePath: string;
  lineNumber?: number | null;
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  // "live" findings come from actually requesting a real demo store URL
  // (real rendered JSON-LD via fetch+parse, real Lighthouse contrast/
  // touch-target audits via PageSpeed Insights) rather than parsing theme
  // source — filePath holds the page URL checked, not a file.
  layer?: "static" | "live";
  // Which preset's demo URL this live finding came from, when an audit
  // ran against more than one (see lib/audit/liveChecks/runLiveChecks.ts's
  // runLiveChecksForPresets). null/undefined for a single-preset run, for
  // static findings, and for the cross-preset comparison findings
  // themselves (distinguishable instead by their LIVE-PRESET-SYNC-* ruleId).
  presetLabel?: string | null;
  finding: string;
  recommendation?: string | null;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  sourceSnippet?: string | null;
  status?: FindingStatus;
  ignoredReason?: string | null;
};

// Severity maps onto the same canonical status tokens (app/globals.css) as
// PASS/FAIL/WARNING/NOT_TESTED — blocker/high are visually "fail"-band,
// medium is "warning"-band, low is neutral — while keeping its own label
// vocabulary, since Finding.severity and check-status are related but
// distinct things.
const SEVERITY_STYLES: Record<string, string> = {
  blocker: "bg-status-fail-bg text-status-fail-text",
  high: "bg-status-fail-bg text-status-fail-text",
  medium: "bg-status-warning-bg text-status-warning-text",
  low: "bg-status-not-tested-bg text-status-not-tested-text",
};

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  blocker: XCircle,
  high: XCircle,
  medium: AlertTriangle,
  low: MinusCircle,
};

export function SeverityBadge({ severity }: { severity: string }) {
  const Icon = SEVERITY_ICON[severity] ?? MinusCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<FindingStatus, string> = {
  open: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ignored: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>{status}</span>
  );
}

export function SummaryBar({ summary }: { summary: FindingSummary }) {
  return (
    <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
      <div>
        <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{summary.total}</div>
        <div className="text-zinc-500">Total findings</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{summary.blocker}</div>
        <div className="text-zinc-500">Blocker</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-orange-700 dark:text-orange-400">{summary.high}</div>
        <div className="text-zinc-500">High</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{summary.medium}</div>
        <div className="text-zinc-500">Medium</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">{summary.low}</div>
        <div className="text-zinc-500">Low</div>
      </div>
    </div>
  );
}

const READINESS_STYLES: Record<ReadinessStatus, string> = {
  READY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  NOT_READY: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  INCOMPLETE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

const READINESS_LABEL: Record<ReadinessStatus, string> = {
  READY: "Ready",
  NOT_READY: "Not ready",
  INCOMPLETE: "Incomplete",
};

/** Never claims a theme is "ready to submit" on the strength of a clean audit alone — INCOMPLETE exists specifically to distinguish "no issues found" from "not enough was checked to say that". */
export function ReadinessPanel({ readiness }: { readiness: ReadinessSummary }) {
  return (
    <div className="rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
      <div className="flex items-center gap-3">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${READINESS_STYLES[readiness.status]}`}>
          {READINESS_LABEL[readiness.status]}
        </span>
        <span className="text-zinc-500">Submission readiness</span>
      </div>
      {readiness.reasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-zinc-600 dark:text-zinc-400">
          {readiness.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {readiness.status === "READY" && (
        <p className="mt-2 text-xs text-zinc-500">
          This reflects the currently-implemented rules only — it is not a guarantee of Shopify Theme Store approval.
        </p>
      )}
    </div>
  );
}

export function CoverageSummaryBar({ coverage }: { coverage: CoverageSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
      <div>
        <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.percentage.toFixed(0)}%</div>
        <div className="text-zinc-500">Automated coverage</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{coverage.total}</div>
        <div className="text-zinc-500">Total requirements</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{coverage.implemented}</div>
        <div className="text-zinc-500">Implemented</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{coverage.partial}</div>
        <div className="text-zinc-500">Partial</div>
      </div>
      <div>
        <div className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">{coverage.notImplemented}</div>
        <div className="text-zinc-500">Not implemented</div>
      </div>
      <p className="w-full text-xs text-zinc-500">
        A clean audit with {coverage.percentage.toFixed(0)}% rule coverage is not equivalent to a fully validated Shopify submission.
      </p>
    </div>
  );
}

/** Surfaces analysis limitations ("could not reliably analyze") separately from findings ("no issue found"), so a clean report reads as trustworthy rather than just quiet. */
export function DiagnosticsNote({ diagnostics }: { diagnostics: AuditDiagnostics }) {
  const notes: string[] = [];
  if (diagnostics.filesSkipped > 0) {
    notes.push(`${diagnostics.filesSkipped} unsupported file(s) in the ZIP were skipped`);
  }
  if (diagnostics.unresolvedDynamicReferences > 0) {
    notes.push(
      `${diagnostics.unresolvedDynamicReferences} section/snippet render target(s) use a dynamic (non-literal) name and could not be checked`
    );
  }
  if (diagnostics.parserWarnings > 0) {
    notes.push(`${diagnostics.parserWarnings} file(s) had parser warnings`);
  }
  if (diagnostics.rulesSkippedDueToError > 0) {
    notes.push(`${diagnostics.rulesSkippedDueToError} rule(s) failed to run and were skipped`);
  }
  if (notes.length === 0) return null;

  return (
    <p className="text-xs text-zinc-500">
      Analysis limitations: {notes.join("; ")}.
    </p>
  );
}

const TIMING_STAGE_LABEL: Record<string, string> = {
  extraction: "ZIP extraction",
  validation: "Theme validation",
  parsing: "Parsing",
  themeIndex: "Theme index",
  ruleExecution: "Rule execution",
  liveChecks: "Live checks",
  findingPersistence: "Finding persistence",
};

const TIMING_STAGE_ORDER = Object.keys(TIMING_STAGE_LABEL);

/** Per-stage timing breakdown for this run (phase-8 §14) — surfaces where the time actually went so a slowdown is visible at a glance, not just a black-box total. */
export function TimingNote({ timingMs }: { timingMs: Record<string, number> }) {
  const stages = TIMING_STAGE_ORDER.filter((key) => typeof timingMs[key] === "number");
  if (stages.length === 0) return null;

  return (
    <details className="text-xs text-zinc-500">
      <summary className="cursor-pointer select-none">
        Audit duration: {((timingMs.total ?? 0) / 1000).toFixed(1)}s
      </summary>
      <ul className="mt-1 ml-4 list-disc">
        {stages.map((key) => (
          <li key={key}>
            {TIMING_STAGE_LABEL[key]}: {timingMs[key]}ms
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatMs(ms: number | undefined): string {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(2)}s` : "—";
}

function scoreBandClass(score: number | undefined): string {
  if (typeof score !== "number") return "text-zinc-500";
  if (score >= 90) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

const SEVERITY_DOT: Record<string, string> = {
  blocker: "bg-red-600",
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-zinc-400",
};

// Every finding lib/audit/pageSpeed.ts's extractOpportunityFindings produces
// uses this ruleId prefix — distinguishes the per-issue "what to fix" list
// from the 4 headline scorecard findings (LIVE-PERF-SCORE/LCP/CLS/TBT-001,
// already shown in the metrics table above).
const OPPORTUNITY_RULE_PREFIX = "LIVE-PERF-LH-";
const SEVERITY_SORT: Record<string, number> = { blocker: 0, high: 1, medium: 2, low: 3 };

export function PageSpeedPanel({ metrics, findings }: { metrics: PageSpeedMetric[]; findings: FindingRow[] }) {
  if (metrics.length === 0) return null;

  const opportunities = findings
    .filter((f) => f.category === "Performance" && f.ruleId.startsWith(OPPORTUNITY_RULE_PREFIX))
    .sort((a, b) => SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity]);
  const submissionBarFindings = findings
    .filter((f) => f.ruleId === "LIVE-SHOPIFY-A11Y-SCORE-001" || f.ruleId === "LIVE-SHOPIFY-PERF-SCORE-001")
    .sort((a, b) => SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity]);
  const multiplePresets = new Set(metrics.map((m) => m.label)).size > 1;

  return (
    <div className="rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.145]">
      <h3 className="font-medium text-zinc-950 dark:text-zinc-50">Page speed</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Preset</th>
              <th className="py-1 pr-3 font-medium">Page</th>
              <th className="py-1 pr-3 font-medium">Device</th>
              <th className="py-1 pr-3 font-medium">Perf.</th>
              <th className="py-1 pr-3 font-medium">A11y</th>
              <th className="py-1 pr-3 font-medium">LCP</th>
              <th className="py-1 pr-3 font-medium">CLS</th>
              <th className="py-1 pr-3 font-medium">TBT</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700 dark:text-zinc-300">
            {metrics.map((m) => (
              <tr key={`${m.label}-${m.url}-${m.pageType}-${m.strategy}`} className="border-t border-black/[.06] dark:border-white/[.08]">
                <td className="py-1.5 pr-3 font-medium text-zinc-950 dark:text-zinc-50">{m.label}</td>
                <td className="py-1.5 pr-3 capitalize">{m.pageType}</td>
                <td className="py-1.5 pr-3 capitalize">{m.strategy}</td>
                <td className={`py-1.5 pr-3 font-medium ${scoreBandClass(m.performanceScore)}`}>
                  {typeof m.performanceScore === "number" ? `${m.performanceScore}/100` : "—"}
                </td>
                <td className={`py-1.5 pr-3 font-medium ${scoreBandClass(m.accessibilityScore)}`}>
                  {typeof m.accessibilityScore === "number" ? `${m.accessibilityScore}/100` : "—"}
                </td>
                <td className="py-1.5 pr-3">{formatMs(m.lcpMs)}</td>
                <td className="py-1.5 pr-3">{typeof m.clsScore === "number" ? m.clsScore.toFixed(2) : "—"}</td>
                <td className="py-1.5 pr-3">{typeof m.tbtMs === "number" ? `${Math.round(m.tbtMs)}ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-xs text-zinc-500">
          Only the baseline preset (the first one supplied) gets the full home/collection/product ×
          mobile/desktop matrix; every other preset shows the homepage/mobile scorecard only.
        </p>
      </div>

      {submissionBarFindings.length > 0 && (
        <div className="mt-4 border-t border-black/[.08] pt-3 dark:border-white/[.145]">
          <h4 className="font-medium text-zinc-950 dark:text-zinc-50">
            Shopify submission bar ({submissionBarFindings.length})
          </h4>
          <p className="mt-0.5 text-xs text-zinc-500">
            Shopify&apos;s own literal Theme Store thresholds — accessibility ≥90 average, performance ≥60 per
            page — checked against the baseline preset&apos;s home, collection, and product pages.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {submissionBarFindings.map((f, i) => (
              <li key={`${f.ruleId}-${f.filePath}-${i}`} className="flex gap-2 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`} aria-hidden />
                <p className="text-zinc-800 dark:text-zinc-200">{f.finding}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="mt-4 border-t border-black/[.08] pt-3 dark:border-white/[.145]">
          <h4 className="font-medium text-zinc-950 dark:text-zinc-50">
            Suggested fixes ({opportunities.length})
          </h4>
          <p className="mt-0.5 text-xs text-zinc-500">
            Lighthouse&apos;s own opportunities and diagnostics, most impactful first — the same &quot;what to
            fix&quot; list PageSpeed Insights/GTmetrix show.
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {opportunities.map((f, i) => (
              <li key={`${f.ruleId}-${f.presetLabel ?? i}`} className="flex gap-2 text-xs">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`} aria-hidden />
                <div>
                  <p className="text-zinc-800 dark:text-zinc-200">
                    {multiplePresets && f.presetLabel && (
                      <span className="font-medium text-zinc-500">[{f.presetLabel}] </span>
                    )}
                    {f.finding}
                  </p>
                  {f.recommendation && <p className="mt-0.5 text-zinc-500">{f.recommendation}</p>}
                  {f.sourceUrl && (
                    <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block underline text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
                      Learn more
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

export type EngineVersions = {
  applicationVersion?: string | null;
  parserVersion?: string | null;
  ruleEngineVersion?: string | null;
  requirementsVersion?: string | null;
};

/** The whole-of-app version snapshot for this run (phase-8 §28) — makes a historical result explainable/reproducible after the app itself has since moved on. */
export function EngineVersionsNote({ versions }: { versions: EngineVersions }) {
  const parts = [
    ["App", versions.applicationVersion],
    ["Parser", versions.parserVersion],
    ["Rule engine", versions.ruleEngineVersion],
    ["Requirements", versions.requirementsVersion],
  ].filter(([, v]) => v) as [string, string][];
  if (parts.length === 0) return null;

  return (
    <p className="text-xs text-zinc-500">
      Versions: {parts.map(([label, v]) => `${label} ${v}`).join(" · ")}
    </p>
  );
}

const CATEGORIES = ["Theme Store Compliance", "Accessibility", "Technical SEO", "Technical AEO", "Performance", "Bug", "Internal Standard"] as const;
const SEVERITIES = ["blocker", "high", "medium", "low"] as const;
const STATUSES: FindingStatus[] = ["open", "resolved", "ignored"];

type SortKey = "severity" | "category" | "file" | "newest" | "status";
const SEVERITY_RANK: Record<string, number> = { blocker: 0, high: 1, medium: 2, low: 3 };

function sortFindings(findings: FindingRow[], key: SortKey): FindingRow[] {
  const copy = [...findings];
  switch (key) {
    case "severity":
      return copy.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99));
    case "category":
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case "file":
      return copy.sort((a, b) => a.filePath.localeCompare(b.filePath));
    case "status":
      return copy.sort((a, b) => (a.status ?? "open").localeCompare(b.status ?? "open"));
    case "newest":
    default:
      return copy;
  }
}

export type RequirementInfo = {
  title: string;
  description: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

function RequirementTraceability({ info }: { info: RequirementInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50">
        {open ? "Hide requirement" : "Why?"}
      </button>
      {open && (
        <div className="mt-1 max-w-xs rounded border border-black/[.08] bg-black/[.02] p-2 dark:border-white/[.145] dark:bg-white/[.03]">
          <div className="font-medium text-zinc-800 dark:text-zinc-200">{info.title}</div>
          <div className="mt-0.5 text-zinc-500">{info.description}</div>
          {info.sourceUrl && (
            <a href={info.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline hover:text-zinc-950 dark:hover:text-zinc-50">
              {info.sourceName ?? "Source"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function FindingsTable({
  findings,
  onStatusChange,
  requirementsById,
}: {
  findings: FindingRow[];
  onStatusChange?: (findingId: string, status: FindingStatus, ignoredReason?: string) => void;
  requirementsById?: Record<string, RequirementInfo>;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [ignoringId, setIgnoringId] = useState<string | null>(null);
  const [ignoreReasonDraft, setIgnoreReasonDraft] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return findings.filter((f) => {
      if (categoryFilter && f.category !== categoryFilter) return false;
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter && (f.status ?? "open") !== statusFilter) return false;
      if (q) {
        const haystack = [f.finding, f.recommendation, f.filePath, f.ruleId, f.requirementId, f.sourceReference]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [findings, search, categoryFilter, severityFilter, statusFilter]);

  const sorted = useMemo(() => sortFindings(filtered, sortKey), [filtered, sortKey]);

  function handleStatusSelect(id: string, value: string) {
    if (value === "ignored") {
      setIgnoringId(id);
      setIgnoreReasonDraft("");
      return;
    }
    onStatusChange?.(id, value as FindingStatus);
  }

  function confirmIgnore(id: string) {
    if (!ignoreReasonDraft.trim()) return;
    onStatusChange?.(id, "ignored", ignoreReasonDraft.trim());
    setIgnoringId(null);
    setIgnoreReasonDraft("");
  }

  if (findings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No findings — every implemented rule passed against this theme.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search findings…"
          className="w-56 rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-1.5 dark:border-white/[.15]"
        >
          <option value="severity">Sort: severity</option>
          <option value="category">Sort: category</option>
          <option value="file">Sort: file</option>
          <option value="status">Sort: status</option>
          <option value="newest">Sort: newest</option>
        </select>
        <span className="self-center text-xs text-zinc-500">
          {sorted.length} of {findings.length} finding{findings.length === 1 ? "" : "s"}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">No findings match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.145]">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-black/[.08] bg-black/[.02] text-xs uppercase text-zinc-500 dark:border-white/[.145] dark:bg-white/[.03] dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Finding</th>
                <th className="px-4 py-3 font-medium">Rule</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f, i) => {
                const status = f.status ?? "open";
                return (
                  <tr
                    key={f._id ?? `${f.ruleId}-${f.filePath}-${f.lineNumber ?? ""}-${i}`}
                    className="border-b border-black/[.06] align-top last:border-0 dark:border-white/[.08]"
                  >
                    <td className="px-4 py-3">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="px-4 py-3">
                      {f.layer === "live" ? (
                        <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          Live
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Static
                        </span>
                      )}
                      {f.presetLabel && (
                        <span className="ml-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                          {f.presetLabel}
                        </span>
                      )}
                      {f.layer === "live" && !f.presetLabel && f.ruleId.startsWith("LIVE-PRESET-SYNC-") && (
                        <span className="ml-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                          Cross-preset
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{f.category}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {f.layer === "live" ? (
                        <a
                          href={f.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-zinc-500 underline hover:text-zinc-950 dark:hover:text-zinc-50"
                        >
                          {f.filePath}
                        </a>
                      ) : (
                        <>
                          {getPageLabel(f.filePath) && (
                            <div className="font-medium text-zinc-700 dark:text-zinc-300">{getPageLabel(f.filePath)}</div>
                          )}
                          <div className="font-mono text-zinc-500">
                            {f.filePath}
                            {f.lineNumber ? `:${f.lineNumber}` : ""}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-950 dark:text-zinc-50">{f.finding}</div>
                      {f.recommendation && <div className="mt-0.5 text-xs text-zinc-500">{f.recommendation}</div>}
                      {f.sourceSnippet && (
                        <pre className="mt-2 overflow-x-auto rounded bg-black/[.04] p-2 text-[11px] leading-snug text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
                          {f.sourceSnippet}
                        </pre>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.sourceUrl ? (
                        <a
                          href={f.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                        >
                          {f.ruleId}
                        </a>
                      ) : (
                        <span className="text-zinc-500">{f.ruleId}</span>
                      )}
                      {f.requirementId && <div className="mt-0.5 text-zinc-400">{f.requirementId}</div>}
                      {f.requirementId && requirementsById?.[f.requirementId] && (
                        <RequirementTraceability info={requirementsById[f.requirementId]} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {onStatusChange && f._id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={status}
                            onChange={(e) => handleStatusSelect(f._id!, e.target.value)}
                            className="rounded-md border border-black/[.12] bg-transparent px-2 py-1 text-xs capitalize dark:border-white/[.15]"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s} className="capitalize">
                                {s}
                              </option>
                            ))}
                          </select>
                          {ignoringId === f._id && (
                            <div className="flex flex-col gap-1">
                              <input
                                autoFocus
                                value={ignoreReasonDraft}
                                onChange={(e) => setIgnoreReasonDraft(e.target.value)}
                                placeholder="Reason for ignoring…"
                                className="w-40 rounded-md border border-black/[.12] bg-transparent px-2 py-1 text-xs dark:border-white/[.15]"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => confirmIgnore(f._id!)}
                                  disabled={!ignoreReasonDraft.trim()}
                                  className="rounded-md bg-zinc-950 px-2 py-1 text-xs text-zinc-50 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIgnoringId(null)}
                                  className="rounded-md border border-black/[.12] px-2 py-1 text-xs dark:border-white/[.15]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {status === "ignored" && f.ignoredReason && (
                            <div className="text-xs text-zinc-500">Reason: {f.ignoredReason}</div>
                          )}
                        </div>
                      ) : (
                        <FindingStatusBadge status={status} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
