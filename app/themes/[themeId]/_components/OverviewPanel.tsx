"use client";

import { useState } from "react";
import Link from "next/link";
import { PresetLinksEditor, type DemoStorePreset } from "@/app/_components/PresetLinksEditor";

type CheckTotals = { total: number; passed: number; failed: number; warnings: number; notTested: number };

type Props = {
  themeId: string;
  themeName: string;
  demoStorePresets: DemoStorePreset[];
  latestVersion: { _id: string; version: string } | null;
  latestAudit: { _id: string; startedAt: string } | null;
  checkTotals: CheckTotals | null;
  onChanged: () => void;
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
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
      <div>
        <h3 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">Presets</h3>
        <p className="mt-1 text-xs text-zinc-500">
          This theme&apos;s style-variant demo store URLs, saved once and reused to pre-fill every &quot;Run Audit&quot;
          (still editable per run).
        </p>
      </div>
      <PresetLinksEditor
        presets={presets}
        onChange={(next) => {
          setPresets(next);
          setSaved(false);
        }}
      />
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-fit rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 disabled:opacity-50 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          {saving ? "Saving…" : "Save presets"}
        </button>
        {saved && <span className="text-xs text-emerald-700 dark:text-emerald-400">Saved.</span>}
      </div>
    </div>
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
    setMessage(
      `${data.reusedZip ? "Matched an existing upload for" : "Stored"} version ${data.themeVersion.version}.`
    );
    onUploaded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.145]">
      <label className="flex flex-col gap-1">
        <span className="text-zinc-700 dark:text-zinc-300">Theme .zip</span>
        <input type="file" accept=".zip" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <span className="text-xs text-zinc-500">
          The version is read from the ZIP&apos;s README — it isn&apos;t entered manually. This does not run an audit.
        </span>
      </label>
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Reading theme…" : "Upload version"}
      </button>
    </form>
  );
}

function RunAuditForm({
  themeId,
  versionId,
  initialPresets,
  onRan,
}: {
  themeId: string;
  versionId: string;
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.145]">
      <div className="flex flex-col gap-2">
        <span className="text-zinc-700 dark:text-zinc-300">Demo store URL(s) (optional — enables live checks)</span>
        <p className="text-xs text-zinc-500">Pre-filled from this theme&apos;s saved presets — edit freely for just this run.</p>
        <PresetLinksEditor presets={presets} onChange={setPresets} />
      </div>
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleRun}
        disabled={submitting}
        className="w-fit rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {submitting ? "Auditing… this may take a moment" : "Run audit"}
      </button>
    </div>
  );
}

export function OverviewPanel({ themeId, themeName, demoStorePresets, latestVersion, latestAudit, checkTotals, onChanged }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [showRunAudit, setShowRunAudit] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-black/[.08] p-5 dark:border-white/[.145]">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{themeName}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {latestVersion ? <>Current Version: {latestVersion.version}</> : "No version tracked yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            Upload Version
          </button>
          <button
            type="button"
            onClick={() => setShowRunAudit((v) => !v)}
            disabled={!latestVersion}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            Run Audit
          </button>
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
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatDate(latestAudit.startedAt)} —{" "}
            <Link href={`/reports/${latestAudit._id}`} className="underline hover:text-zinc-950 dark:hover:text-zinc-50">
              view full report
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">No completed audit yet.</p>
        )}

        {checkTotals && (
          <div className="mt-4 flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
            <div>
              <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{checkTotals.total}</div>
              <div className="text-zinc-500">Checks</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{checkTotals.passed}</div>
              <div className="text-zinc-500">Passed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-red-700 dark:text-red-400">{checkTotals.failed}</div>
              <div className="text-zinc-500">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400">{checkTotals.warnings}</div>
              <div className="text-zinc-500">Warnings</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-500">{checkTotals.notTested}</div>
              <div className="text-zinc-500">Not tested</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
