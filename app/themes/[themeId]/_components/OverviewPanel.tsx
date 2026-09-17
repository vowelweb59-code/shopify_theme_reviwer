"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";
import { Button } from "@/app/_components/ui/Button";
import { Card, CardHeader } from "@/app/_components/ui/Card";
import { ScoreboardGrid } from "./ScoreboardGrid";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type Props = {
  themeId: string;
  themeName: string;
  demoStorePresets: DemoStorePreset[];
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
  scoreboard: ScoreCard[] | null;
  onChanged: () => void;
  onNavigateScoreCard: (card: ScoreCard) => void;
};

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

function PresetsSection({ themeId, initialPresets, onSaved }: { themeId: string; initialPresets: DemoStorePreset[]; onSaved: () => void }) {
  const [presets, setPresets] = useState<DemoStorePreset[]>(initialPresets);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const validPresets = presets.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
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
    setSaved(true);
    onSaved();
  }

  return (
    <Card>
      <CardHeader
        title="Presets"
        description={'This theme’s style-variant demo store URLs, saved once and reused to pre-fill every “Run Audit” (still editable per run).'}
      />
      <div className="flex flex-col gap-3">
        <PresetLinksEditor
          presets={presets}
          onChange={(next) => {
            setPresets(next);
            setSaved(false);
          }}
        />
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
            {saving ? "Saving…" : "Save presets"}
          </Button>
          {saved && <span className="text-xs text-status-pass-text">Saved.</span>}
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
  initialPresets,
  onRan,
}: {
  themeId: string;
  versionId: string;
  version: string;
  themeName: string;
  initialPresets: DemoStorePreset[];
  onRan: () => void;
}) {
  const [presets, setPresets] = useState<DemoStorePreset[]>(initialPresets);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setSubmitting(true);
    setError(null);
    const validPresets = presets.map((p, i) => ({ label: p.label.trim() || `Preset ${i + 1}`, url: p.url.trim() })).filter((p) => p.url);
    const res = await fetch(`/api/themes/${themeId}/versions/${versionId}/audit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demoStorePresets: validPresets }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to run the audit.");
      return;
    }
    onRan();
  }

  if (submitting) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-status-info-icon" aria-hidden />
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Auditing {themeName} {version}…
            </p>
            <p className="text-xs text-zinc-500">This runs the full rule engine — it may take a moment.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-2">
          <span className="text-zinc-700 dark:text-zinc-300">Demo store URL(s) (optional — enables live checks)</span>
          <p className="text-xs text-zinc-500">Pre-filled from this theme&apos;s saved presets — edit freely for just this run.</p>
          <PresetLinksEditor presets={presets} onChange={setPresets} />
        </div>
        {error && <div className="rounded-md border border-red-300 bg-status-fail-bg px-3 py-2 text-xs text-status-fail-text">{error}</div>}
        <Button size="sm" onClick={handleRun} className="w-fit">
          Run audit
        </Button>
      </div>
    </Card>
  );
}

export function OverviewPanel({ themeId, themeName, demoStorePresets, latestVersion, latestAudit, checkTotals, scoreboard, onChanged, onNavigateScoreCard }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [showRunAudit, setShowRunAudit] = useState(false);
  const healthPercent = checkTotals && checkTotals.total > 0 ? Math.round((checkTotals.passed / checkTotals.total) * 100) : null;

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
          initialPresets={demoStorePresets}
          onRan={() => {
            setShowRunAudit(false);
            onChanged();
          }}
        />
      )}

      <PresetsSection themeId={themeId} initialPresets={demoStorePresets} onSaved={onChanged} />

      <div>
        <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Latest Audit</h3>
        {latestAudit ? (
          <p className="mt-1 text-sm text-zinc-500">{formatDate(latestAudit.startedAt)}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">No completed audit yet.</p>
        )}

        {scoreboard && (
          <div className="mt-4">
            <ScoreboardGrid cards={scoreboard} onNavigate={onNavigateScoreCard} />
          </div>
        )}
      </div>
    </div>
  );
}
