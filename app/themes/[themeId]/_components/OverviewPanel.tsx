"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { SeverityBadge } from "@/app/_components/findings";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ScoreboardGrid } from "./ScoreboardGrid";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";
import type { CategoryChecks } from "@/lib/themes/deriveChecksForAuditRun";
import { AUDIT_STAGES, percentForStage, type AuditStageKey } from "@/lib/audit/progress";
import { AVAILABLE_FEATURES, featureStatus } from "@/lib/audit/availableFeatures";

const POLL_INTERVAL_MS = 1500;

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type Props = {
  themeId: string;
  themeName: string;
  demoStorePresets: DemoStorePreset[];
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
  scoreboard: ScoreCard[] | null;
  // Set when this run's own page-speed data was entirely missing (every
  // PSI call failed) and the Desktop/Mobile Performance cards are instead
  // showing an older complete run's last real measurement.
  pageSpeedFallback: { auditRunId: string; startedAt: string } | null;
  categories: CategoryChecks[];
  onChanged: () => void;
};

// The subset of a Finding document this panel actually reads, fetched
// from the same endpoint the Report tab used to use — loaded eagerly for
// the Recommendations block below, and reused (not re-fetched) when a
// scoreboard card is expanded.
type ReportFinding = {
  _id: string;
  ruleId: string;
  category: string;
  severity: string;
  finding: string;
  recommendation?: string | null;
  filePath: string;
  presetLabel?: string | null;
  status?: string;
};

type ReportEnhancementPoint = {
  pointId: string;
  title: string;
  description?: string;
  detected: boolean | null;
};

const SEVERITY_ORDER: Record<string, number> = { blocker: 0, high: 1, medium: 2, low: 3 };

// Same bg/text pairing SeverityBadge uses (app/_components/findings.tsx's
// SEVERITY_STYLES) — reused here as a left-border accent instead, so the
// Recommendations list reads as color-coded-by-severity at a glance without
// introducing a second, competing color convention.
const SEVERITY_BORDER: Record<string, string> = {
  blocker: "border-l-status-fail-icon",
  high: "border-l-status-fail-icon",
  medium: "border-l-status-warning-icon",
  low: "border-l-status-not-tested-icon",
};

// Every Performance finding's text explicitly says "(mobile)" or
// "(desktop)" (see lib/audit/pageSpeed.ts's psiThresholdFindings/
// extractOpportunityFindings/shopifySubmissionBarFindings, all of which
// take an explicit strategy) — no separate strategy field exists on
// ExecutedFinding, so this substring is the one signal available to split
// the two cards' issue lists without a schema change.
function isDesktopPerformanceFinding(f: ReportFinding): boolean {
  return /\(desktop\)/i.test(f.finding);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function healthTone(percent: number) {
  if (percent >= 90) return "text-status-pass-text";
  if (percent >= 70) return "text-status-warning-text";
  return "text-status-fail-text";
}

function PresetsSection({
  themeId,
  initialPresets,
  latestAuditId,
  onSaved,
}: {
  themeId: string;
  initialPresets: DemoStorePreset[];
  latestAuditId: string | null;
  onSaved: () => void;
}) {
  const [presets, setPresets] = useState<DemoStorePreset[]>(initialPresets);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DemoStorePreset[]>(initialPresets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [findings, setFindings] = useState<{ auditRunId: string; items: ReportFinding[] } | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  function startEditing() {
    setDraft(presets);
    setError(null);
    setEditing(true);
  }

  async function togglePreset(label: string) {
    if (expandedPreset === label) {
      setExpandedPreset(null);
      return;
    }
    setExpandedPreset(label);
    if (!latestAuditId) return;
    if (findings?.auditRunId === latestAuditId) return; // already loaded for this run

    setFindingsLoading(true);
    setFindingsError(null);
    try {
      const res = await fetch(`/api/reports/${latestAuditId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFindingsError(data.error ?? "Failed to load issues for this preset.");
        return;
      }
      setFindings({ auditRunId: latestAuditId, items: data.findings ?? [] });
    } catch {
      setFindingsError("Lost connection to the server while loading issues.");
    } finally {
      setFindingsLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const validPresets = draft.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
    try {
      const res = await fetch(`/api/themes/${themeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoStorePresets: validPresets }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setError(data.error ?? "Failed to save presets.");
        return;
      }
      setPresets(data.theme.demoStorePresets ?? []);
      setEditing(false);
      onSaved();
    } catch {
      setSaving(false);
      setError("Lost connection to the server. Try again.");
    }
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader
          title="Presets"
          description="This theme’s style-variant demo store URLs, reused to pre-fill every “Run Audit”."
          action={
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          }
        />
        {presets.length === 0 ? (
          <p className="text-sm text-zinc-500">No presets saved yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {presets.map((preset, i) => {
              const isOpen = expandedPreset === preset.label;
              const presetFindings = findings?.items.filter((f) => f.presetLabel === preset.label) ?? [];
              return (
                <li key={i} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => togglePreset(preset.label)}
                    aria-expanded={isOpen}
                    className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm"
                  >
                    <span className="font-medium text-zinc-900 underline decoration-dotted hover:text-primary dark:text-zinc-100">
                      {preset.label}
                    </span>
                    <span className="text-zinc-500">{preset.url}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-2 rounded-md border border-border-subtle bg-surface-muted p-3">
                      {!latestAuditId ? (
                        <p className="text-xs text-zinc-500">Run an audit to see this preset&apos;s issues.</p>
                      ) : findingsLoading ? (
                        <p className="text-xs text-zinc-500">Loading issues…</p>
                      ) : findingsError ? (
                        <p className="text-xs text-status-fail-text">{findingsError}</p>
                      ) : presetFindings.length === 0 ? (
                        <p className="text-xs text-zinc-500">No issues found for this preset.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {presetFindings.map((f) => (
                            <IssueRow key={f._id} body={f.finding} severity={f.severity} filePath={f.filePath} recommendation={f.recommendation} />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Presets" description="Edit this theme’s style-variant demo store URLs." />
      <div className="flex flex-col gap-3">
        <PresetLinksEditor presets={draft} onChange={setDraft} />
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} loading={saving}>
            {saving ? "Saving…" : "Save presets"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

function UploadVersionForm({ themeId, onUploaded }: { themeId: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choose a theme .zip file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const res = await fetch(`/api/themes/${themeId}/versions`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      setSubmitting(false);
      if (!res.ok) {
        setError(data.error ?? "Failed to upload this version.");
        return;
      }
      setFile(null);
      setMessage(`${data.reusedZip ? "Matched an existing upload for" : "Stored"} version ${data.themeVersion.version}.`);
      onUploaded();
    } catch {
      setSubmitting(false);
      setError("Lost connection to the server. Try again.");
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-700 dark:text-zinc-300">Theme .zip</span>
          <input type="file" accept=".zip" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <span className="text-xs text-zinc-500">
            The version is read from config/settings_schema.json or the ZIP&apos;s README — it isn&apos;t entered manually.
            This does not run an audit.
          </span>
        </label>
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>}
        {message && <p className="text-xs text-status-pass-text">{message}</p>}
        <Button size="sm" loading={submitting} className="w-fit">
          {submitting ? "Reading theme…" : "Upload version"}
        </Button>
      </form>
    </Card>
  );
}

function RunAuditForm({
  themeId,
  versionId,
  version,
  themeName,
  presets,
  onRan,
}: {
  themeId: string;
  versionId: string;
  version: string;
  themeName: string;
  presets: DemoStorePreset[];
  onRan: () => void;
}) {
  // Starts immediately once mounted (see the mount effect below) — this
  // component only ever renders because the user just clicked "Run Audit",
  // so there's no reason to make them confirm with a second click. Uses
  // the theme's already-saved presets (edit those via the Presets section
  // below if a different set is needed) rather than offering an ad hoc,
  // easy-to-miss "edit for just this run" form.
  const [submitting, setSubmitting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<AuditStageKey | null>(null);
  const [stageProgress, setStageProgress] = useState<{ completed: number; total: number } | null>(null);
  const activeRef = useRef(true);
  // Without this, React StrictMode's dev-only double-invoke of the mount
  // effect below would fire handleRun() twice per click, starting two
  // separate audit runs from a single "Run Audit" press.
  const startedRef = useRef(false);
  useEffect(() => {
    // Reset to true on every effect run, not just via useRef's initial
    // value — React's dev-only StrictMode double-invokes effects
    // (setup -> cleanup -> setup) right after mount without actually
    // unmounting the component, so a cleanup-only assignment here left
    // this permanently false before handleRun/pollUntilDone ever ran,
    // silently killing the poll loop on its very first iteration.
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  async function pollUntilDone(auditRunId: string) {
    while (activeRef.current) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (!activeRef.current) return;
      try {
        const res = await fetch(`/api/audit/${auditRunId}`);
        const data = await res.json().catch(() => ({}));
        const run = data.auditRun;
        if (!res.ok || !run) continue; // a transient poll hiccup — the run may still be completing server-side, keep trying

        setStage(run.currentStage ?? null);
        setStageProgress(run.stageProgress ?? null);

        if (run.status === "complete") {
          setSubmitting(false);
          onRan();
          return;
        }
        if (run.status === "failed") {
          setSubmitting(false);
          setError(run.error ?? "The audit failed.");
          return;
        }
      } catch {
        // Network hiccup while polling — keep polling rather than giving up;
        // the run itself keeps progressing on the server regardless.
      }
    }
  }

  async function handleRun() {
    setSubmitting(true);
    setError(null);
    setStage(null);
    setStageProgress(null);
    const validPresets = presets.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
    // The audit itself can run for well over a minute (live checks/page
    // speed) — this request only waits for the AuditRun row to be created
    // (near-instant), then hands off to polling below. A dropped connection
    // here (dev server restart) still throws, so it stays in a try/catch:
    // without one, the throw was unhandled and setSubmitting(false) never
    // ran, leaving the UI stuck on the spinner indefinitely.
    try {
      const res = await fetch(`/api/themes/${themeId}/versions/${versionId}/audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoStorePresets: validPresets }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.auditRun) {
        setSubmitting(false);
        setError(data.error ?? "Failed to run the audit.");
        return;
      }
      pollUntilDone(data.auditRun._id);
    } catch {
      setSubmitting(false);
      setError("Lost connection to the server while starting the audit. Try again.");
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    handleRun();
    // fire exactly once on mount; handleRun/presets intentionally not deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!submitting && error) {
    return (
      <Card>
        <div className="flex flex-col gap-2 text-sm">
          <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>
          <Button size="sm" onClick={handleRun} className="w-fit">
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  if (submitting) {
    const percent = percentForStage(stage, stageProgress);
    const stageLabel = stage ? AUDIT_STAGES[stage].label : "Starting…";
    return (
      <Card>
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-status-info-icon" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Auditing {themeName} {version}…
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {stageLabel}
              {stage === "checking_live" && stageProgress && stageProgress.total > 0 && (
                <> — {stageProgress.completed} of {stageProgress.total} checked</>
              )}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Unreachable in practice (submitting starts true and only flips false
  // once complete or failed, both handled above) — a safe fallback rather
  // than an assumption the caller can't break.
  return null;
}

// Score cards whose issues live in the audit run's Finding docs /
// enhancement-point coverage rather than in the already-fetched
// `categories` prop — expanding one of these lazily fetches
// /api/reports/{auditRunId} (the same endpoint the Report tab uses) the
// first time it's opened, then reuses that result for the rest.
const REPORT_BACKED_CARD_IDS = new Set(["desktop-performance", "mobile-performance", "opportunities", "features"]);

function IssueRow({
  title,
  body,
  severity,
  filePath,
  recommendation,
}: {
  title?: string;
  body: string;
  severity?: string;
  filePath?: string;
  recommendation?: string | null;
}) {
  return (
    <li className="rounded-md bg-surface-muted p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {severity && <SeverityBadge severity={severity} />}
        {title && <span className="font-medium text-zinc-900 dark:text-zinc-100">{title}</span>}
      </div>
      {/* The specific "what/where" — the exact source location or affected
          asset — comes before the generic "how to fix" text below, since
          without it the recommendation alone isn't actionable (a real
          finding like "theme.css — 13KB — 958ms" is what's needed to find
          the actual thing to fix, not just "reduce render-blocking
          requests" on its own). */}
      {filePath && <p className="mt-1 font-mono text-zinc-500">{filePath}</p>}
      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{body}</p>
      {recommendation && (
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Fix: </span>
          {recommendation}
        </p>
      )}
    </li>
  );
}

export function OverviewPanel({
  themeId,
  themeName,
  demoStorePresets,
  latestVersion,
  latestAudit,
  checkTotals,
  scoreboard,
  pageSpeedFallback,
  categories,
  onChanged,
}: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [showRunAudit, setShowRunAudit] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{ auditRunId: string; findings: ReportFinding[]; enhancementPoints: ReportEnhancementPoint[] } | null>(
    null
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const healthPercent = checkTotals && checkTotals.total > 0 ? Math.round((checkTotals.passed / checkTotals.total) * 100) : null;

  async function loadReportData(auditRunId: string) {
    if (reportData?.auditRunId === auditRunId) return; // already loaded for this run
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/reports/${auditRunId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(data.error ?? "Failed to load issues for this run.");
        return;
      }
      setReportData({ auditRunId, findings: data.findings ?? [], enhancementPoints: data.enhancementPoints ?? [] });
    } catch {
      setReportError("Lost connection to the server while loading issues.");
    } finally {
      setReportLoading(false);
    }
  }

  // Loaded eagerly (not just lazily on a scoreboard card click) since the
  // Recommendations block below needs it immediately, unconditionally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id-change is the well-established exception this rule itself documents
    if (latestAudit) loadReportData(latestAudit._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAudit?._id]);

  async function handleToggleCard(card: ScoreCard) {
    if (expandedCardId === card.id) {
      setExpandedCardId(null);
      return;
    }
    setExpandedCardId(card.id);
    if (!REPORT_BACKED_CARD_IDS.has(card.id) || !latestAudit) return;
    await loadReportData(latestAudit._id);
  }

  // Top issues to prioritize for the next theme update: one per distinct
  // rule (not one row per occurrence — the same issue can legitimately hit
  // dozens of files/pages), worst severity first, capped at 5. Ignored/
  // resolved findings are excluded since the user has already dealt with
  // those. Uses each finding's own `recommendation` text (falling back to
  // the finding description when a rule has none) — this is the one place
  // in the app that surfaces that field as the headline rather than as a
  // secondary detail.
  const recommendations = (() => {
    if (!reportData) return [];
    const bestByRule = new Map<string, ReportFinding & { count: number }>();
    for (const f of reportData.findings) {
      if (f.status === "ignored" || f.status === "resolved") continue;
      const existing = bestByRule.get(f.ruleId);
      if (existing) existing.count += 1;
      else bestByRule.set(f.ruleId, { ...f, count: 1 });
    }
    return [...bestByRule.values()]
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
      .slice(0, 5);
  })();

  function renderExpanded(card: ScoreCard) {
    if (REPORT_BACKED_CARD_IDS.has(card.id)) {
      if (reportLoading) return <p className="text-sm text-zinc-500">Loading issues…</p>;
      if (reportError) return <p className="text-sm text-status-fail-text">{reportError}</p>;
      if (!reportData) return null;

      if (card.id === "opportunities") {
        const remaining = reportData.enhancementPoints.filter((p) => p.detected === false);
        if (remaining.length === 0) return <p className="text-sm text-zinc-500">No remaining opportunities — every checked point is covered.</p>;
        return (
          <ul className="flex flex-col gap-2">
            {remaining.map((p) => (
              <IssueRow key={p.pointId} title={p.title} body={p.description ?? "Not yet covered by this theme."} />
            ))}
          </ul>
        );
      }

      if (card.id === "features") {
        // Reuses the same enhancementPoints this run already returned (the
        // same source featuresScoreCard's score is computed from) — a
        // feature's `pointIds` are OR'd together, matching featureStatus's
        // own logic, just built from the report response instead of
        // AuditRun.enhancementDetections directly.
        const detections = new Map(reportData.enhancementPoints.map((p) => [p.pointId, p.detected === true]));
        const missing = AVAILABLE_FEATURES.filter((f) => featureStatus(f, detections) === "not_detected");
        if (missing.length === 0) return <p className="text-sm text-zinc-500">No missing features among those checked.</p>;
        return (
          <ul className="flex flex-col gap-2">
            {missing.map((f) => (
              <IssueRow key={f.id} title={f.label} body={f.note ?? `Not detected in this theme (category: ${f.category}).`} />
            ))}
          </ul>
        );
      }

      const isDesktop = card.id === "desktop-performance";
      const relevant = reportData.findings.filter((f) => f.category === "Performance" && isDesktopPerformanceFinding(f) === isDesktop);
      if (relevant.length === 0) return <p className="text-sm text-zinc-500">No {isDesktop ? "desktop" : "mobile"} performance issues found.</p>;
      return (
        <ul className="flex flex-col gap-2">
          {relevant.map((f) => (
            <IssueRow
              key={f._id}
              body={f.finding}
              severity={f.severity}
              filePath={f.presetLabel ?? f.filePath}
              recommendation={f.recommendation}
            />
          ))}
        </ul>
      );
    }

    // accessibility / seo / store-requirement / internal-standards: already
    // have everything needed in `categories`, no fetch required.
    const categoryNames: Record<string, string[]> = {
      accessibility: ["Accessibility"],
      seo: ["Technical SEO", "Technical AEO"],
      "store-requirement": ["Theme Store Compliance"],
      "internal-standards": ["Internal Standard"],
    };
    const names = categoryNames[card.id] ?? [];
    const items = categories.filter((c) => names.includes(c.category)).flatMap((c) => c.items);
    const failing = items.filter((i) => i.status === "FAIL" || i.status === "WARNING");
    if (failing.length === 0) return <p className="text-sm text-zinc-500">No open issues in this category.</p>;
    return (
      <ul className="flex flex-col gap-2">
        {failing.map((item) => (
          <IssueRow
            key={item.key}
            title={item.title}
            body={item.evidence[0]?.finding ?? item.description}
            severity={item.evidence[0]?.severity}
            filePath={item.evidence[0]?.filePath}
            recommendation={item.recommendation}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border-subtle p-5">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{themeName}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {latestVersion ? <>Version {latestVersion.version}</> : "No version tracked yet"}
            </p>
          </div>
          {healthPercent !== null && (
            <div className="text-right">
              <div className={`text-2xl font-semibold ${healthTone(healthPercent)}`}>{healthPercent}%</div>
              <div className="text-xs text-zinc-500">Health</div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowUpload((v) => !v)}>
            Upload Version
          </Button>
          <Button size="sm" onClick={() => setShowRunAudit((v) => !v)} disabled={!latestVersion}>
            Run Audit
          </Button>
        </div>
      </div>

      {showUpload && (
        <UploadVersionForm
          themeId={themeId}
          onUploaded={() => {
            setShowUpload(false);
            onChanged();
          }}
        />
      )}

      {showRunAudit && latestVersion && (
        <RunAuditForm
          themeId={themeId}
          versionId={latestVersion._id}
          version={latestVersion.version}
          themeName={themeName}
          presets={demoStorePresets}
          onRan={() => {
            setShowRunAudit(false);
            onChanged();
          }}
        />
      )}

      <PresetsSection themeId={themeId} initialPresets={demoStorePresets} latestAuditId={latestAudit?._id ?? null} onSaved={onChanged} />

      <div>
        <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Latest Audit</h3>
        {latestAudit ? (
          <p className="mt-1 text-sm text-zinc-500">{formatDate(latestAudit.startedAt)}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">No completed audit yet.</p>
        )}

        {pageSpeedFallback && (
          <p className="mt-2 rounded-md border border-status-warning-bg bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
            Page speed data couldn&apos;t be measured for this run (every PageSpeed Insights request failed) — Desktop/Mobile Performance
            below are the last real measurements, from the run on {formatDate(pageSpeedFallback.startedAt)}.
          </p>
        )}

        {latestAudit && recommendations.length > 0 && (
          <div className="mt-4">
            <Card>
              <CardHeader
                title="Recommendations for next update"
                description="Top open issues to prioritize, ranked by severity — color-coded blocker/high (red), medium (amber), low (gray)."
              />
              <ul className="flex flex-col gap-2">
                {recommendations.map((r) => (
                  <li key={r.ruleId} className={`border-l-4 rounded-md bg-surface-muted p-3 text-sm ${SEVERITY_BORDER[r.severity] ?? SEVERITY_BORDER.low}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={r.severity} />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{r.category}</span>
                      {r.count > 1 && <span className="text-xs text-zinc-500">({r.count} occurrences)</span>}
                    </div>
                    {/* The source/what — exact file or affected asset — before
                        the generic fix, same reasoning as IssueRow: a
                        recommendation alone ("reduce render-blocking
                        requests") isn't actionable without knowing which
                        file it's actually about. */}
                    {(r.presetLabel ?? r.filePath) && <p className="mt-1 font-mono text-xs text-zinc-500">{r.presetLabel ?? r.filePath}</p>}
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">{r.finding}</p>
                    {r.recommendation && (
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">Fix: </span>
                        {r.recommendation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {scoreboard && (
          <div className="mt-4">
            <ScoreboardGrid cards={scoreboard} expandedCardId={expandedCardId} onToggle={handleToggleCard} renderExpanded={renderExpanded} />
          </div>
        )}
      </div>
    </div>
  );
}
