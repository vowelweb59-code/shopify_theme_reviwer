"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { AUDIT_STAGES, percentForStage, type AuditStageKey } from "@/lib/audit/progress";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

export type DevThemeRow = {
  theme: { _id: string; name: string; demoStorePresets?: DemoStorePreset[]; gitRepoUrl?: string | null };
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
};

const POLL_MS = 2000;

/**
 * Themes that are not on the Theme Store yet (under development), with a manual Theme Store readiness check for each:
 * pick the theme's ZIP (or reuse the last one uploaded), give its demo-store URL(s), and run the same audit the theme page runs.
 * The result is the health percentage and the failed / warning counts; the theme page has the full findings.
 */
export function UnderDevelopmentSection({ rows, onChanged }: { rows: DevThemeRow[]; onChanged: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Under development</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Themes that are not on the Shopify Theme Store yet. Check each one for Theme Store readiness by hand: upload its ZIP, give its demo
          store URL(s) and run the check. A new theme added with “Add Theme” appears here until it goes live.
        </p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No theme is under development. Add one with “Add Theme”; it shows here until it is live on the Theme Store.</p>
        </Card>
      ) : (
        rows.map((row) => <DevThemeCard key={row.theme._id} row={row} onChanged={onChanged} />)
      )}
    </div>
  );
}

function DevThemeCard({ row, onChanged }: { row: DevThemeRow; onChanged: () => void }) {
  const { theme, latestVersion, latestAudit, checkTotals } = row;
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [presets, setPresets] = useState<DemoStorePreset[]>(theme.demoStorePresets?.length ? theme.demoStorePresets : [{ label: "", url: "" }]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<AuditStageKey | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const health = checkTotals && checkTotals.total > 0 ? Math.round((checkTotals.passed / checkTotals.total) * 100) : null;
  const tone = health === null ? "" : health >= 90 ? "text-status-pass-text" : health >= 70 ? "text-status-warning-text" : "text-status-fail-text";

  async function handleRun() {
    setError(null);
    setDone(false);
    if (!file && !latestVersion) {
      setError("Choose the theme's .zip file first: nothing has been uploaded for this theme yet.");
      return;
    }
    setRunning(true);
    setStage(null);
    setProgress(null);
    try {
      let versionId = latestVersion?._id ?? "";
      if (file) {
        const form = new FormData();
        form.set("file", file);
        const up = await fetch(`/api/themes/${theme._id}/versions`, { method: "POST", body: form });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error ?? "Could not upload the ZIP.");
        versionId = upData.themeVersion._id;
      }
      const valid = presets.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
      const start = await fetch(`/api/themes/${theme._id}/versions/${versionId}/audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoStorePresets: valid }),
      });
      const startData = await start.json().catch(() => ({}));
      if (!start.ok || !startData.auditRun) throw new Error(startData.error ?? "Could not start the check.");
      // Polls until the audit finishes (it can take a few minutes: live pages and PageSpeed).
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const res = await fetch(`/api/audit/${startData.auditRun._id}`);
        const data = await res.json().catch(() => ({}));
        const run = data.auditRun;
        if (!res.ok || !run) continue;
        setStage(run.currentStage ?? null);
        setProgress(run.stageProgress ?? null);
        if (run.status === "complete") break;
        if (run.status === "failed") throw new Error(run.error ?? "The check failed.");
      }
      setFile(null);
      setDone(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The check failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={theme.name}
        description={latestVersion ? `Latest uploaded version ${latestVersion.version}` : "No version uploaded yet"}
        action={
          <div className="flex gap-2">
            <Link href={`/themes/${theme._id}`} className="inline-flex items-center rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-surface-muted">
              Full report
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide check" : "Check Theme Store readiness"}
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 text-sm">
        {health !== null && checkTotals ? (
          <p className="text-zinc-600 dark:text-zinc-300">
            Last check: <span className={`font-semibold ${tone}`}>{health}% ready</span> · {checkTotals.passed} passed · {checkTotals.failed} failed · {checkTotals.warnings} warnings
            {checkTotals.notTested > 0 ? ` · ${checkTotals.notTested} not tested` : ""}
          </p>
        ) : (
          <p className="text-zinc-500">{latestAudit ? "The last check has no results yet." : "Not checked yet."}</p>
        )}
        {open && (
          <div className="flex flex-col gap-3 rounded-md border border-border-subtle p-3">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-700 dark:text-zinc-300">Theme ZIP {latestVersion ? "(leave empty to check the last uploaded version)" : ""}</span>
              <input type="file" accept=".zip,application/zip" disabled={running} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-zinc-700 dark:text-zinc-300">Demo store URL(s)</span>
              <PresetLinksEditor presets={presets} onChange={setPresets} />
              <p className="text-xs text-zinc-500">The live-store checks (speed, demo content, features) read these. Without one, only the code is checked.</p>
            </div>
            {running && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-status-info-icon" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-500">
                    {stage ? AUDIT_STAGES[stage].label : "Starting…"}
                    {stage === "checking_live" && progress && progress.total > 0 ? ` — ${progress.completed} of ${progress.total} checked` : ""}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percentForStage(stage, progress)}%` }} />
                  </div>
                </div>
              </div>
            )}
            {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>}
            {done && <p className="text-xs text-status-pass-text">Check finished. The result is shown above; open the full report for each finding.</p>}
            <Button size="sm" onClick={handleRun} loading={running} className="w-fit">
              {running ? "Checking…" : "Run check"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
